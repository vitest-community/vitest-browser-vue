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
  unmount(): void
  emitted<T = unknown>(): Record<string, T[]>
  emitted<T = unknown[]>(eventName: string): undefined | T[]
  rerender(props: Partial<Props>): void
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
    unmount: () => wrapper.unmount(),
    emitted: ((name?: string) => wrapper.emitted(name as string)) as any,
    rerender: props => wrapper.setProps(props as any),
    ...getElementLocatorSelectors(baseElement),
  };
  // implement auto trace marking when users called `then` i.e. `await render(...)`
  const renderResultPromiseLike: PromiseLike<RenderResult<P>> = {
    async then(onfulfilled, onrejected) {
      try {
        await mark(renderResult.locator, 'vue.render', renderResultPromiseLike.then);
        return Promise.resolve(renderResult).then(onfulfilled, onrejected)
      } catch (e) {
        return Promise.reject(e).then(onfulfilled, onrejected)
      }
    }
  }
  return { ...renderResult, ...renderResultPromiseLike  }
}

function mark(locator: Locator, name: string, fn: Function) {
  if (!locator.mark) {
    return
  }

  const error = new Error(name)
  if ('captureStackTrace' in Error) {
    (Error as any).captureStackTrace(error, fn)
  }
  return locator.mark(name, error)
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
