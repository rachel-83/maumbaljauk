import React from 'react';

export default function RoleSelector({ role, onRoleSelect }) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">나는 누구인가요?</h2>
      <button 
        onClick={() => onRoleSelect('student')}
        className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${role === 'student' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-primary-300 text-gray-800 bg-white'}`}
      >
        <div className="text-4xl">🎓</div>
        <div className="text-xl font-bold">학생</div>
        <div className="text-sm opacity-80 font-medium">대화하고 마음을 기록해요</div>
      </button>
      <button 
        onClick={() => onRoleSelect('teacher')}
        className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${role === 'teacher' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 hover:border-orange-300 text-gray-800 bg-white'}`}
      >
        <div className="text-4xl">👩‍🏫</div>
        <div className="text-xl font-bold">선생님</div>
        <div className="text-sm opacity-80 font-medium">우리 반 마음 건강을 살펴요</div>
      </button>
    </div>
  );
}
