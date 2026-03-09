import type { Locator, LocatorSelectors, PrettyDOMOptions } from 'vitest/browser'
import { page, server, utils } from 'vitest/browser'
import { type ComponentMountingOptions, type VueWrapper, mount } from '@vue/test-utils'
import type { DefineComponent } from 'vue'

export { config } from '@vue/test-utils'

const { debug, getElementLocatorSelectors } = utils

type ComponentProps<T> = T extends new (...args: any) => {
  $props: infer P
// eslint-disable-next-line ts/no-empty-object-type
} ? NonNullable<P> : T extends (props: infer P, ...args: any) => any ? P : {}

const mountedWrappers = new Set<VueWrapper>()

export interface RenderResult<Props> extends LocatorSelectors {
  container: HTMLElement
  baseElement: HTMLElement
  locator: Locator
  debug(el?: HTMLElement | HTMLElement[] | Locator | Locator[], maxLength?: number, options?: PrettyDOMOptions): void
  /** Unmount the component. Can be awaited to record a `vue.unmount` trace mark. */
  unmount(): void & PromiseLike<void>
  emitted<T = unknown>(): Record<string, T[]>
  emitted<T = unknown[]>(eventName: string): undefined | T[]
  /** Update the component props. Can be awaited to record a `vue.rerender` trace mark. */
  rerender(props: Partial<Props>): void & PromiseLike<void>
}

export interface ComponentRenderOptions<C, P extends ComponentProps<C>> extends ComponentMountingOptions<C, P> {
  container?: HTMLElement
  baseElement?: HTMLElement
}

let idx = 0
function ensureTestIdAttribute(element: HTMLElement) {
  const attributeId = server.config.browser.locators.testIdAttribute
  if (!element.hasAttribute(attributeId)) {
    element.setAttribute(attributeId, `__vitest_${idx++}__`)
  }
}

/**
 * Render a Vue component into the document.
 * Can be awaited to record a `vue.render` trace mark.
 */
export function render<T, C = T extends ((...args: any) => any) | (new (...args: any) => any) ? T : T extends {
  props?: infer Props
} ? DefineComponent<Props extends Readonly<(infer PropNames)[]> | (infer PropNames)[] ? {
    [key in PropNames extends string ? PropNames : string]?: any;
  } : Props> : DefineComponent, P extends ComponentProps<C> = ComponentProps<C>>(
  Component: T,
  {
    container: customContainer,
    baseElement: customBaseElement,
    ...mountOptions
  }: ComponentRenderOptions<C, P> = {},
): RenderResult<P> & PromiseLike<RenderResult<P>> {
  const baseElement = customBaseElement || customContainer || document.body
  const container = customContainer || baseElement.appendChild(document.createElement('div'))

  // Ensuring testid attributes exists so that the generated locators will be stable
  // https://github.com/vitest-community/vitest-browser-react/issues/42
  ensureTestIdAttribute(baseElement)
  ensureTestIdAttribute(container)

  if (mountOptions.attachTo) {
    throw new Error('`attachTo` is not supported, use `container` instead')
  }

  const wrapper = mount(Component, {
    ...mountOptions,
    attachTo: container,
  })

  // this removes the additional wrapping div node from VTU:
  // https://github.com/vuejs/vue-test-utils-next/blob/master/src/mount.ts#L309
  unwrapNode((wrapper as any).parentElement)

  mountedWrappers.add(wrapper as any)

  const renderResult: RenderResult<P> = {
    container,
    baseElement,
    locator: page.elementLocator(container),
    debug: (el = baseElement, maxLength, options) => debug(el, maxLength, options),
    unmount: () => {
      wrapper.unmount()
      return markThenable(renderResult.locator, 'vue.unmount', renderResult.unmount, undefined) as any
    },
    emitted: ((name?: string) => wrapper.emitted(name as string)) as any,
    rerender: (props) => {
      wrapper.setProps(props as any)
      return markThenable(renderResult.locator, 'vue.rerender', renderResult.rerender, undefined) as any
    },
    ...getElementLocatorSelectors(baseElement),
  }
  return { ...renderResult, ...markThenable(renderResult.locator, 'vue.render', render, renderResult) }
}

// implement auto trace marking when users called `then` i.e. `await render(...)`
function markThenable<T>(locator: Locator, name: string, fn: Function, value: T): PromiseLike<T> {
  if (!locator.mark) {
    return Promise.resolve(value)
  }
  const error = new Error(name)
  if ('captureStackTrace' in Error) {
    (Error as any).captureStackTrace(error, fn)
  }
  return {
    async then(onfulfilled, onrejected) {
      try {
        await locator.mark(name, error)
        return Promise.resolve(value).then(onfulfilled, onrejected)
      }
      catch (e) {
        return Promise.reject(e).then(onfulfilled, onrejected)
      }
    },
  }
}

export function cleanup(): void {
  mountedWrappers.forEach((wrapper) => {
    if (wrapper.element?.parentNode?.parentNode === document.body) {
      document.body.removeChild(wrapper.element.parentNode)
    }

    wrapper.unmount()
    mountedWrappers.delete(wrapper)
  })
}

function unwrapNode(node: Element) {
  node.replaceWith(...node.childNodes)
}
