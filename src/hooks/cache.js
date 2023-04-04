import { useState } from 'react'
import useSWR from 'swr'

export default function useCache(key, keyData, doUpdateAsync, onUpdateSuccess, onUpdateError) {
  const [loadDelayReached, setLoadDelayReached] = useState(false)
  
  const update = async ({keyData}) => {
    const timeoutId = setTimeout(() => setLoadDelayReached(true), 500)
    const result = await doUpdateAsync(keyData)
    return {
      keyData,
      timeoutId,
      result
    }
  }

  // { data, error, isLoading, isValidating, mutate }
  const result = useSWR({key, keyData}, update, {
    dedupingInterval: 0,
    loadingTimeout: 500,
    revalidateOnFocus: false,
    onSuccess: ({keyData, timeoutId, result}) => {
      onUpdateSuccess(result, keyData)
      setLoadDelayReached(false)
      clearTimeout(timeoutId)
    },
    onError: (error, {keyData}) => {
      onUpdateError(error, keyData)
      setLoadDelayReached(false)
    }
  })

  let showLoading = false
  if (loadDelayReached) {
    if (result.isValidating) {
      showLoading = true
    } else {
      setLoadDelayReached(false)
    }
  }

  return {
    ...result,
    showLoading
  }
}