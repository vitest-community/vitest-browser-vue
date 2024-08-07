import { expect, test } from 'vitest'
import { page } from '@vitest/browser/context'
import { render } from '../src/index'
import HelloWorld from './fixtures/HelloWorld.vue'
import Counter from './fixtures/Counter.vue'

test('renders simple component', async () => {
  const screen = render(HelloWorld)
  await expect.element(page.getByText('Hello World')).toBeVisible()
  expect(screen.container).toMatchSnapshot()
})

test('renders counter', async () => {
  const screen = render(Counter, {
    props: {
      initialCount: 1,
    },
  })

  await expect.element(screen.getByText('Count is 1')).toBeVisible()
  await screen.getByRole('button', { name: 'Increment' }).click()
  await expect.element(screen.getByText('Count is 2')).toBeVisible()
})
