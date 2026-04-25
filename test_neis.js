const fetch = require('node-fetch');
async function test() {
  const res1 = await fetch('https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=5&SCHUL_NM=' + encodeURIComponent('한국글로벌중학교'));
  const data1 = await res1.json();
  const school = data1.schoolInfo[1].row[0];
  console.log('School:', school.SCHUL_NM, school.ATPT_OFCDC_SC_CODE, school.SD_SCHUL_CODE);

  const sido = school.ATPT_OFCDC_SC_CODE;
  const sch = school.SD_SCHUL_CODE;
  
  const ymd = '20260416';
  const grade = 1;
  const classNum = 1;
  const url = `https://open.neis.go.kr/hub/misTimetable?Type=json&pIndex=1&pSize=15&ATPT_OFCDC_SC_CODE=${sido}&SD_SCHUL_CODE=${sch}&ALL_TI_YMD=${ymd}&GRADE=${grade}&CLASS_NM=${classNum}`;
  console.log('Timetable URL:', url);
  
  const res2 = await fetch(url);
  const data2 = await res2.json();
  console.log('Timetable Response:', JSON.stringify(data2, null, 2));
}
test();
