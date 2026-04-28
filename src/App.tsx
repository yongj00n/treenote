import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { useSubjects } from './hooks/useSubjects';

function App() {
  const { subjects, addSubject, deleteSubject } = useSubjects();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        subjects={subjects}
        selectedId={selectedSubjectId}
        onSelect={setSelectedSubjectId}
        onAdd={addSubject}
        onDelete={async (id) => {
          await deleteSubject(id);
          if (selectedSubjectId === id) setSelectedSubjectId(null);
        }}
      />

      {/* 오른쪽 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto flex items-center justify-center">
        {subjects.length === 0 ? (
          <div className="text-center space-y-3">
            <p className="text-4xl">📚</p>
            <p className="text-xl font-semibold text-gray-700">첫 과목을 만들어보세요</p>
            <p className="text-sm text-gray-400">왼쪽 사이드바의 <strong>과목 추가</strong> 버튼을 눌러보세요</p>
          </div>
        ) : selectedSubject ? (
          <div className="text-center space-y-2">
            <span
              className="inline-block w-4 h-4 rounded-full mb-1"
              style={{ backgroundColor: selectedSubject.color }}
            />
            <p className="text-2xl font-bold text-gray-800">{selectedSubject.name}</p>
            <p className="text-sm text-gray-400">Week 3에서 트리 노드를 추가할 예정입니다</p>
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
