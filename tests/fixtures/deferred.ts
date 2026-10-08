// 応答のタイミングをテスト側で決めるためのPromise。遅延・失敗・順序の検証に使う。
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
