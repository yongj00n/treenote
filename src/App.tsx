import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { NodeView } from './components/NodeView';
import { useSubjects } from './hooks/useSubjects';
import { type Subject } from './db/database';

function App() {
  const { subjects, addSubject, deleteSubject } = useSubjects();
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  function handleSelectSubject(id: string) {
    const subject = subjects.find((s) => s.id === id);
    if (subject) setSelectedSubject(subject);
  }

  async function handleDeleteSubject(id: string) {
    await deleteSubject(id);
    if (selectedSubject?.id === id) setSelectedSubject(null);
  }

  const fresh = selectedSubject
    ? (subjects.find((s) => s.id === selectedSubject.id) ?? selectedSubject)
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        subjects={subjects}
        selectedId={selectedSubject?.id ?? null}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        onSelect={handleSelectSubject}
        onAdd={addSubject}
        onDelete={handleDeleteSubject}
      />

      <main className="flex-1 overflow-hidden">
        {fresh ? (
          <NodeView
            subject={fresh}
            onBack={() => setSelectedSubject(null)}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
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
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
