import { afterEach } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'

// mountした部品はテストごとに自動でunmountする。テスト内で個別にunmountしない。
enableAutoUnmount(afterEach)
