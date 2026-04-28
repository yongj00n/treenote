import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { NodeView } from './components/NodeView';
import { useSubjects } from './hooks/useSubjects';
import { type Subject } from './db/database';

function App() {
  const { subjects, addSubject, deleteSubject } = useSubjects();
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  function handleSelectSubject(id: string) {
    const subject = subjects.find((s) => s.id === id);
    if (subject) setSelectedSubject(subject);
  }

  async function handleDeleteSubject(id: string) {
    await deleteSubject(id);
    if (selectedSubject?.id === id) setSelectedSubject(null);
  }

  // 과목이 선택되면 노드 뷰로 전환
  if (selectedSubject) {
    // subjects가 업데이트되면 최신 데이터로 동기화
    const fresh = subjects.find((s) => s.id === selectedSubject.id) ?? selectedSubject;
    return (
      <NodeView
        subject={fresh}
        onBack={() => setSelectedSubject(null)}
      />
    );
  }

  // 기본: 과목 목록 화면
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        subjects={subjects}
        selectedId={null}
        onSelect={handleSelectSubject}
        onAdd={addSubject}
        onDelete={handleDeleteSubject}
      />

      <main className="flex-1 overflow-y-auto flex items-center justify-center">
        {subjects.length === 0 ? (
          <div className="text-center space-y-3">
            <p className="text-4xl">📚</p>
            <p className="text-xl font-semibold text-gray-700">첫 과목을 만들어보세요</p>
            <p className="text-sm text-gray-400">
              왼쪽 사이드바의 <strong>과목 추가</strong> 버튼을 눌러보세요
            </p>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <p className="text-3xl">👈</p>
            <p className="text-gray-500">왼쪽에서 과목을 선택하세요</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
