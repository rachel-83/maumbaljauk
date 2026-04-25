import React, { useState } from 'react';

/**
 * 학교 선택 + 학년/반/번호 입력 컴포넌트
 * @param {Object} props
 * @param {(info) => void} props.onSelect
 * @param {'student'|'teacher'} props.role  - 학생이면 번호도 입력, 교사는 번호 생략
 */
export default function SchoolSelector({ onSelect, role = 'student' }) {
  const [query, setQuery] = useState('');
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [grade, setGrade] = useState('');
  const [classNum, setClassNum] = useState('');
  const [studentNum, setStudentNum] = useState('');
  const [loading, setLoading] = useState(false);

  const isStudent = role === 'student';

  const searchSchool = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const apiKey = import.meta.env.VITE_NEIS_API_KEY || '';
      const url = `https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=20&SCHUL_NM=${encodeURIComponent(query)}${apiKey ? `&KEY=${apiKey}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.schoolInfo) {
        setSchools(data.schoolInfo[1].row);
      } else {
        setSchools([]);
      }
    } catch (e) {
      console.error(e);
      alert('학교 검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedSchool) return;
    onSelect({
      sido_code: selectedSchool.ATPT_OFCDC_SC_CODE,
      school_code: selectedSchool.SD_SCHUL_CODE,
      school_name: selectedSchool.SCHUL_NM,
      grade: grade ? parseInt(grade, 10) : null,
      class_num: classNum ? parseInt(classNum, 10) : null,
      student_num: isStudent && studentNum ? parseInt(studentNum, 10) : null,
    });
  };

  // 필수 필드 충족 여부
  const canConfirm =
    selectedSchool &&
    grade && classNum &&
    (!isStudent || studentNum);

  return (
    <div className="flex flex-col gap-4 w-full">
      <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">소속 학교 찾기</h2>
      <p className="text-sm text-gray-500 text-center -mt-2">
        {isStudent ? '학교를 찾고 학년/반/번호를 알려줘' : '학교를 찾고 담당 학년/반을 알려주세요'}
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && searchSchool()}
          placeholder="학교 이름 검색 (예: 서울중)"
          className="flex-1 p-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
        />
        <button
          onClick={searchSchool}
          disabled={loading}
          className="bg-primary-600 text-white px-6 py-4 rounded-xl font-bold shadow-sm hover:bg-primary-700 disabled:bg-gray-400"
        >
          {loading ? '...' : '검색'}
        </button>
      </div>

      {schools.length > 0 && (
        <ul className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-inner divide-y divide-gray-100 mt-2">
          {schools.map(s => (
            <li
              key={s.SD_SCHUL_CODE}
              onClick={() => setSelectedSchool(s)}
              className={`p-4 cursor-pointer text-sm font-medium ${
                selectedSchool?.SD_SCHUL_CODE === s.SD_SCHUL_CODE
                  ? 'bg-primary-50 text-primary-700'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              {s.SCHUL_NM} <span className="text-gray-400 text-xs ml-2">{s.LCTN_SC_NM}</span>
            </li>
          ))}
        </ul>
      )}

      {selectedSchool && (
        <div className="mt-2 fade-up">
          <div className="text-center font-bold text-gray-700 bg-primary-50 p-3 rounded-xl mb-3 border border-primary-100">
            ✓ {selectedSchool.SCHUL_NM}
          </div>

          <p className="text-xs text-gray-500 font-semibold mb-2">
            {isStudent ? '학년 / 반 / 번호를 입력해줘' : '담당 학년 / 반을 입력해주세요'}
          </p>

          <div className={`grid ${isStudent ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
            <input
              type="number"
              min="1"
              max="6"
              placeholder="학년"
              value={grade}
              onChange={e => setGrade(e.target.value)}
              className="p-4 rounded-xl border border-gray-300 focus:ring-primary-500 focus:border-primary-500 shadow-sm text-center text-lg font-bold"
            />
            <input
              type="number"
              min="1"
              max="30"
              placeholder="반"
              value={classNum}
              onChange={e => setClassNum(e.target.value)}
              className="p-4 rounded-xl border border-gray-300 focus:ring-primary-500 focus:border-primary-500 shadow-sm text-center text-lg font-bold"
            />
            {isStudent && (
              <input
                type="number"
                min="1"
                max="50"
                placeholder="번호"
                value={studentNum}
                onChange={e => setStudentNum(e.target.value)}
                className="p-4 rounded-xl border border-gray-300 focus:ring-primary-500 focus:border-primary-500 shadow-sm text-center text-lg font-bold"
              />
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={!canConfirm}
        className="mt-6 w-full bg-primary-600 text-white py-4 rounded-2xl font-bold text-base shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        다음 단계로
      </button>
    </div>
  );
}
