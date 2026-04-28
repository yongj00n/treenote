import { useEffect, useState } from 'react'
import { db } from './db/database'

type DbStatus = 'checking' | 'connected' | 'error'

function App() {
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking')

  useEffect(() => {
    db.open()
      .then(() => setDbStatus('connected'))
      .catch(() => setDbStatus('error'))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-5xl font-bold text-indigo-600">Tree Note</h1>
        <p className="text-gray-400 text-sm">학습용 트리 노트 — Week 1 스캐폴딩</p>

        <div className="pt-4">
          {dbStatus === 'checking' && (
            <span className="text-gray-400 text-sm">DB 확인 중...</span>
          )}
          {dbStatus === 'connected' && (
            <span className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
              TreeNoteDB 연결됨
            </span>
          )}
          {dbStatus === 'error' && (
            <span className="inline-flex items-center gap-2 bg-red-100 text-red-700 text-sm px-3 py-1 rounded-full">
              DB 연결 실패
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
