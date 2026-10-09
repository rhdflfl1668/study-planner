import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { CalendarDays, CalendarRange, Check, ChevronLeft, ChevronRight, Leaf, ListTodo, Plus, Sprout, Settings2, Trash2, BookOpen, X } from 'lucide-react';
import './styles.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const weekStartKey = value => { const d=new Date(`${value}T12:00:00`); d.setDate(d.getDate()-((d.getDay()+6)%7)); return dateKey(d); };
const weekRangeLabel = (startValue,endValue) => { const start=new Date(`${startValue}T12:00:00`), end=new Date(`${endValue}T12:00:00`); return `${start.getMonth()+1}/${start.getDate()}~${end.getMonth()+1}/${end.getDate()}`; };
const addDaysKey = (value,amount) => { const d=new Date(`${value}T12:00:00`); d.setDate(d.getDate()+amount); return dateKey(d); };
const parseWeekGoal = (key,content) => { const raw=key.slice(5), parts=raw.split('~'), start=parts[0], end=parts[1]||addDaysKey(start,6); return {key,start,end,content}; };
const weeklyGoalList = goals => Object.entries(goals).filter(([key,value])=>key.startsWith('week:')&&String(value||'').trim()).map(([key,value])=>parseWeekGoal(key,value));
const sample = () => ({ tasks: [
  {id:'t1',title:'영어 단어 20개 복습',subject:'영어',date:todayISO(),completed:true,note:''},
  {id:'t2',title:'전공 개념 정리',subject:'전공',date:todayISO(),completed:false,note:''}
] });
const subjectColor = ['subject-sage','subject-sand','subject-rose','subject-blue'];
function App(){
  const [view,setView]=useState('daily');
  const [selectedDate,setSelectedDate]=useState(todayISO());
  const [data,setData]=useState(sample);
  const [periodGoals,setPeriodGoals]=useState(()=>{try{return JSON.parse(localStorage.getItem('study-planner-period-goals')||'{}')}catch{return {}}});
  const [goalDrafts,setGoalDrafts]=useState({});
  const [modal,setModal]=useState(null);
  const [draft,setDraft]=useState({});
  const [user,setUser]=useState(null);
  const [authOpen,setAuthOpen]=useState(false);
  const [authEmail,setAuthEmail]=useState('');
  const [authPassword,setAuthPassword]=useState('');
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(false);
  const cloudReady=!!supabase;

  useEffect(()=>{
    if(!supabase)return;
    supabase.auth.getSession().then(({data:{session}})=>setUser(session?.user||null));
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user||null));
    return ()=>listener.subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    try{localStorage.setItem('study-planner-period-goals',JSON.stringify(periodGoals));}catch{}
  },[periodGoals]);
  useEffect(()=>{
    if(!supabase||!user){if(!user)setData(d=>d||sample());return;}
    (async()=>{
      setLoading(true);
      const {data:rows,error}=await supabase.from('study_tasks').select('*').order('study_date');
      if(!error)setData({tasks:rows.map(x=>({id:x.id,title:x.title,subject:x.subject||'',date:x.study_date,completed:!!x.completed,note:x.note||''}))});
      else setMessage('클라우드 데이터를 불러오지 못했어요. Supabase 설정과 SQL 실행 여부를 확인해 주세요.');
      const goalResult=await supabase.from('study_period_goals').select('goal_type,period_key,content');
      if(!goalResult.error){const cloudGoals={};goalResult.data.forEach(g=>{cloudGoals[`${g.goal_type}:${g.period_key}`]=g.content});setPeriodGoals(prev=>({...Object.fromEntries(Object.entries(prev).filter(([key])=>!key.startsWith('week:'))),...cloudGoals}));}
      setLoading(false);
    })();
  },[user]);

  const year=Number(selectedDate.slice(0,4)), month=Number(selectedDate.slice(5,7)), day=Number(selectedDate.slice(8,10));
  const dayTasks=data.tasks.filter(t=>t.date===selectedDate);
  const monthTasks=data.tasks.filter(t=>t.date?.startsWith(`${year}-${String(month).padStart(2,'0')}`));
  const monthGoalKey=`month:${year}-${String(month).padStart(2,'0')}`;
  const weeklyGoals=weeklyGoalList(periodGoals);
  const activeWeekGoal=weeklyGoals.find(g=>g.start<=selectedDate&&g.end>=selectedDate);
  const defaultWeekStart=weekStartKey(selectedDate), defaultWeekEnd=addDaysKey(defaultWeekStart,6);
  const weekGoalKey=activeWeekGoal?activeWeekGoal.key:`week:${defaultWeekStart}~${defaultWeekEnd}`;
  const weekGoalStart=activeWeekGoal?.start||defaultWeekStart, weekGoalEnd=activeWeekGoal?.end||defaultWeekEnd;
  async function savePeriodGoal(type,key,content){
    const id=`${type}:${key}`,clean=(content||'').trim();
    setPeriodGoals(prev=>({...prev,[id]:clean}));
    if(supabase&&user){const {error}=await supabase.from('study_period_goals').upsert({user_id:user.id,goal_type:type,period_key:key,content:clean},{onConflict:'user_id,goal_type,period_key'});if(error){setMessage('목표를 클라우드에 저장하지 못했어요. 최신 SQL 설정을 확인해 주세요.');return;}}
    setGoalDrafts(prev=>({...prev,[id]:clean}));setMessage('목표를 저장했어요.');
  }
  async function saveWeeklyGoal(oldKey,start,end,content){
    if(!start||!end){setMessage('시작 날짜와 종료 날짜를 선택해 주세요.');return;}
    if(start>end){setMessage('종료 날짜는 시작 날짜와 같거나 이후여야 해요.');return;}
    const newKey=`week:${start}~${end}`, newPeriodKey=`${start}~${end}`, clean=(content||'').trim();

    // Save the new period first so the existing goal is preserved if saving fails.
    if(supabase&&user){
      const {error}=await supabase.from('study_period_goals').upsert(
        {user_id:user.id,goal_type:'week',period_key:newPeriodKey,content:clean},
        {onConflict:'user_id,goal_type,period_key'}
      );
      if(error){setMessage('주간 목표를 클라우드에 저장하지 못했어요: '+error.message);return;}

      // Remove the old period only after the new one has been saved successfully.
      if(oldKey&&oldKey!==newKey){
        const oldPeriodKey=oldKey.slice(5);
        const {error:deleteError}=await supabase.from('study_period_goals').delete()
          .eq('user_id',user.id).eq('goal_type','week').eq('period_key',oldPeriodKey);
        if(deleteError){setMessage('새 목표는 저장했지만 이전 기간의 목표 정리는 실패했어요. 새로고침 후 확인해 주세요.');return;}
      }
    }

    setPeriodGoals(prev=>{const next={...prev};if(oldKey&&oldKey!==newKey)delete next[oldKey];next[newKey]=clean;return next;});
    setGoalDrafts(prev=>({...prev,[newKey]:clean}));
    setSelectedDate(start);
    setMessage('주간 목표와 날짜를 저장했어요.');
  }
  async function saveTask(task){
    const clean={...task,title:task.title.trim(),subject:(task.subject||'').trim(),note:(task.note||'').trim()};
    if(supabase&&user){
      const row={user_id:user.id,title:clean.title,subject:clean.subject,study_date:clean.date,planned_minutes:0,actual_minutes:0,completed:!!clean.completed,note:clean.note};
      const result=clean.id&&!String(clean.id).startsWith('tmp')?await supabase.from('study_tasks').update(row).eq('id',clean.id).select().single():await supabase.from('study_tasks').insert(row).select().single();
      if(result.error){setMessage('저장에 실패했어요: '+result.error.message);return;}
      clean.id=result.data.id;
    }
    setData(d=>({...d,tasks:clean.id&&d.tasks.some(t=>t.id===clean.id)?d.tasks.map(t=>t.id===clean.id?clean:t):[...d.tasks,clean]}));
    setModal(null);
  }
  async function toggleTask(task){
    const updated={...task,completed:!task.completed};
    if(supabase&&user){const {error}=await supabase.from('study_tasks').update({completed:updated.completed}).eq('id',task.id);if(error){setMessage('변경 사항을 저장하지 못했어요.');return;}}
    setData(d=>({...d,tasks:d.tasks.map(t=>t.id===task.id?updated:t)}));
  }
  async function deleteTask(task){
    if(supabase&&user){const {error}=await supabase.from('study_tasks').delete().eq('id',task.id);if(error){setMessage('삭제에 실패했어요.');return;}}
    setData(d=>({...d,tasks:d.tasks.filter(t=>t.id!==task.id)}));
  }
  async function auth(action){
    if(!supabase){setMessage('.env 파일에 Supabase URL과 키를 설정해 주세요.');return;}
    setLoading(true);
    const res=action==='signup'?await supabase.auth.signUp({email:authEmail,password:authPassword}):await supabase.auth.signInWithPassword({email:authEmail,password:authPassword});
    setLoading(false);
    if(res.error)setMessage(res.error.message);else{setMessage(action==='signup'?'가입 요청을 보냈어요. 이메일 확인이 필요할 수 있어요.':'로그인했어요.');setAuthOpen(false);}
  }
  function moveDate(delta){
    const d=new Date(`${selectedDate}T12:00:00`);
    if(view==='year')d.setFullYear(d.getFullYear()+delta);
    else if(view==='month')d.setMonth(d.getMonth()+delta);
    else d.setDate(d.getDate()+delta);
    setSelectedDate(dateKey(d));
  }
  const monthLabel=new Date(year,month-1,1).toLocaleDateString('ko-KR',{year:'numeric',month:'long'});
  const weekday=new Date(`${selectedDate}T12:00:00`).toLocaleDateString('ko-KR',{weekday:'long'});
  const openNewTask=(date=selectedDate)=>{setDraft({date,title:'',subject:'',completed:false,note:''});setModal('task');};
  const selectDay=(key)=>{setSelectedDate(key);setView('daily');};

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Sprout size={22}/></div><div><div className="brand-name">차곡차곡</div><div className="brand-sub">작은 공부가 쌓이는 곳</div></div></div><button className="icon-btn settings" onClick={()=>setAuthOpen(true)} aria-label="설정"><Settings2 size={19}/></button></header>
    <main>
      <section className="greeting"><div className="eyebrow"><Leaf size={14}/> YOUR STUDY JOURNAL</div><h1>{view==='daily'?'오늘의 공부를,':view==='month'?'달력으로 살펴봐요,':'한 해의 달력을 한눈에,'}<br/><span>{view==='daily'?'차곡차곡 기록해요.':view==='month'?'하루씩 채워가요.':'나만의 속도로 가요.'}</span></h1><p>공부한 과목을 기록하고, 끝낸 목표에 체크해 보세요.</p></section>
      <section className="view-switch" aria-label="플래너 화면 선택"><button className={view==='year'?'active':''} onClick={()=>setView('year')}><CalendarRange size={16}/> 연간</button><button className={view==='month'?'active':''} onClick={()=>setView('month')}><CalendarDays size={16}/> 월간</button><button className={view==='daily'?'active':''} onClick={()=>setView('daily')}><ListTodo size={16}/> 일간</button></section>
      <section className="date-navigation"><button className="icon-btn" onClick={()=>moveDate(-1)} aria-label="이전"><ChevronLeft size={20}/></button><div className="date-heading">{view==='year'?`${year}년 달력`:view==='month'?monthLabel:`${month}월 ${day}일`}<small>{view==='daily'?weekday:view==='month'?'날짜별 과목과 완료 상태':'월을 선택해 상세 달력 보기'}</small></div><button className="icon-btn" onClick={()=>moveDate(1)} aria-label="다음"><ChevronRight size={20}/></button><button className="today-btn" onClick={()=>{setSelectedDate(todayISO());if(view==='year')setView('year')}}>오늘</button></section>

      {view==='daily'&&<>
        <WeeklyGoalEditor key={weekGoalKey} title="주간 목표" subtitle="기간은 원하는 날짜로 직접 설정할 수 있어요." value={periodGoals[weekGoalKey]||''} initialStart={weekGoalStart} initialEnd={weekGoalEnd} onSave={(start,end,content)=>saveWeeklyGoal(weekGoalKey,start,end,content)} />
        <section className="section-head daily-section-head"><div><div className="eyebrow">DAILY STUDY NOTES</div><h2>오늘의 공부 목록</h2></div><button className="add-btn" onClick={()=>openNewTask()}><Plus size={17}/> 추가</button></section>
        <TaskList tasks={dayTasks} toggleTask={toggleTask} editTask={t=>{setDraft({...t});setModal('task')}} deleteTask={deleteTask}/>
        <section className="quote-card"><div className="quote-icon"><Sprout size={19}/></div><div><strong>오늘의 작은 성취도 충분해요.</strong><p>한 가지씩 기록하며 나만의 공부 습관을 만들어 봐요.</p></div></section>
      </>}

      {view==='month'&&<>
        <GoalEditor title={`${month}월 목표`} subtitle="이번 달에 이루고 싶은 공부 목표" icon="month" value={periodGoals[monthGoalKey]||''} draft={goalDrafts[monthGoalKey]} onDraft={v=>setGoalDrafts(prev=>({...prev,[monthGoalKey]:v}))} onSave={v=>savePeriodGoal('month',`${year}-${String(month).padStart(2,'0')}`,v)} />
        <WeeklyGoalEditor key={weekGoalKey} title="주간 목표" subtitle="시작일과 종료일을 직접 수정할 수 있어요." value={periodGoals[weekGoalKey]||''} initialStart={weekGoalStart} initialEnd={weekGoalEnd} onSave={(start,end,content)=>saveWeeklyGoal(weekGoalKey,start,end,content)} />
        <MonthCalendar year={year} month={month} selectedDate={selectedDate} tasks={data.tasks} periodGoals={periodGoals} onSelect={selectDay}/>
        <section className="section-head"><div><div className="eyebrow">STUDY NOTES</div><h2>{month}월의 기록</h2></div><button className="add-btn" onClick={()=>openNewTask(selectedDate)}><Plus size={17}/> 추가</button></section>
        <TaskList tasks={[...monthTasks].sort((a,b)=>a.date.localeCompare(b.date))} toggleTask={toggleTask} editTask={t=>{setDraft({...t});setModal('task')}} deleteTask={deleteTask} showDate/>
      </>}

      {view==='year'&&<YearCalendar year={year} selectedDate={selectedDate} tasks={data.tasks} periodGoals={periodGoals} onSelectMonth={(m)=>{setSelectedDate(`${year}-${String(m).padStart(2,'0')}-01`);setView('month')}} onSelectDay={selectDay}/>}

      <footer className="app-footer"><span><Leaf size={13}/> 조금씩, 꾸준히</span><span>{loading?'불러오는 중…':cloudReady?(user?'클라우드 동기화':'Supabase 연결 설정됨'):'미리보기 모드'}</span></footer>
    </main>
    <nav className="bottom-nav"><button className={view==='year'?'nav-active':''} onClick={()=>setView('year')}><CalendarRange size={19}/><span>연간</span></button><button className={view==='month'?'nav-active':''} onClick={()=>setView('month')}><CalendarDays size={19}/><span>월간</span></button><button className={view==='daily'?'nav-active':''} onClick={()=>setView('daily')}><BookOpen size={19}/><span>일간</span></button><button onClick={()=>setAuthOpen(true)}><Settings2 size={19}/><span>계정</span></button></nav>
    {message&&<div className="toast" role="status">{message}<button onClick={()=>setMessage('')}><X size={16}/></button></div>}

    {modal==='task'&&<div className="modal-backdrop" onClick={()=>setModal(null)}><form className="modal" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();if(!draft.title?.trim())return setMessage('공부 목표를 입력해 주세요.');saveTask({...draft,title:draft.title.trim()})}}>
      <div className="modal-head"><h3>공부 기록</h3><button type="button" className="icon-btn" onClick={()=>setModal(null)}><X size={18}/></button></div>
      <label>공부 목표<input autoFocus value={draft.title||''} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="예: 영어 단어 20개 복습" required/></label>
      <label>날짜<input type="date" value={draft.date||selectedDate} onChange={e=>setDraft({...draft,date:e.target.value})} required/></label>
      <label>과목<input value={draft.subject||''} onChange={e=>setDraft({...draft,subject:e.target.value})} placeholder="예: 영어, 수학, 자격증"/></label>
      <label>메모<textarea rows="3" value={draft.note||''} onChange={e=>setDraft({...draft,note:e.target.value})} placeholder="공부한 내용이나 복습할 부분"/></label>
      <label className="checkbox-label"><input type="checkbox" checked={!!draft.completed} onChange={e=>setDraft({...draft,completed:e.target.checked})}/> 목표 완료</label>
      <button className="primary-btn" type="submit">저장하기</button>
    </form></div>}

    {authOpen&&<div className="modal-backdrop" onClick={()=>setAuthOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><h3>계정 및 동기화</h3><button className="icon-btn" onClick={()=>setAuthOpen(false)}><X size={18}/></button></div>{!cloudReady?<><div className="notice"><Settings2 size={19}/><div><strong>Supabase 연결이 아직 필요해요</strong><p>.env 파일에 프로젝트 URL과 공개 키를 입력하고 SQL 설정을 완료하면 계정을 사용할 수 있어요.</p></div></div><p className="modal-note">현재 화면은 미리보기 모드이며, 클라우드 저장은 연결 설정 후 활성화됩니다. 미리보기 데이터는 새로고침 후 유지된다고 보장되지 않아요.</p></>:user?<><div className="signed-in">로그인됨<br/><strong>{user.email}</strong></div><button className="primary-btn" onClick={async()=>{await supabase.auth.signOut();setMessage('로그아웃했어요.')}}>로그아웃</button></>:<><p className="modal-note">이메일과 비밀번호로 로그인하거나 새 계정을 만들 수 있어요.</p><label>이메일<input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="you@example.com"/></label><label>비밀번호<input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} minLength="6" placeholder="6자 이상"/></label><div className="form-row"><button className="primary-btn" disabled={loading} onClick={()=>auth('signin')}>로그인</button><button className="secondary-btn" disabled={loading} onClick={()=>auth('signup')}>회원가입</button></div></>}</div></div>}
  </div>;
}


function WeeklyGoalEditor({title,subtitle,value,initialStart,initialEnd,onSave}){
  const [editing,setEditing]=useState(false);
  const [start,setStart]=useState(initialStart);
  const [end,setEnd]=useState(initialEnd);
  const [content,setContent]=useState(value||'');
  useEffect(()=>{setStart(initialStart);setEnd(initialEnd);setContent(value||'');setEditing(false);},[initialStart,initialEnd,value]);
  return <section className="period-goal-card">
    <div className="period-goal-heading"><div className="period-goal-icon"><Sprout size={18}/></div><div className="period-goal-title"><strong>{title}</strong><small>{subtitle}</small></div><button className="goal-edit-btn" onClick={()=>setEditing(v=>!v)}>{editing?'닫기':value?'수정':'목표 입력'}</button></div>
    {editing?<div className="period-goal-editor"><div className="goal-date-range"><label>시작일<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>종료일<input type="date" value={end} min={start} onChange={e=>setEnd(e.target.value)}/></label></div><textarea rows="3" value={content} onChange={e=>setContent(e.target.value)} placeholder="예: 이번 주 강의 3개 듣고 복습하기"/><button className="primary-btn" onClick={()=>{onSave(start,end,content);setEditing(false)}}>주간 목표 저장</button></div>:<><p className={`period-goal-text ${value?'':'is-empty'}`}>{value||'아직 목표가 없어요. 목표와 기간을 설정해 보세요.'}</p><div className="weekly-goal-range">{weekRangeLabel(initialStart,initialEnd)}</div></>}
  </section>;
}

function GoalEditor({title,subtitle,icon,value,draft,onDraft,onSave}){
  const [editing,setEditing]=useState(false);
  const current=draft===undefined?value:draft;
  return <section className="period-goal-card">
    <div className="period-goal-heading"><div className="period-goal-icon">{icon==='month'?<CalendarDays size={18}/>:<Sprout size={18}/>}</div><div className="period-goal-title"><strong>{title}</strong><small>{subtitle}</small></div><button className="goal-edit-btn" onClick={()=>{onDraft(value);setEditing(v=>!v)}}>{editing?'닫기':value?'수정':'목표 입력'}</button></div>
    {editing?<div className="period-goal-editor"><textarea rows="3" value={current} onChange={e=>onDraft(e.target.value)} placeholder={icon==='month'?'예: 이번 달 영어 단어 500개 외우기':'예: 이번 주 강의 3개 듣고 복습하기'}/><button className="primary-btn" onClick={()=>{onSave(current);setEditing(false)}}>목표 저장</button></div>:<p className={`period-goal-text ${value?'':'is-empty'}`}>{value||'아직 목표가 없어요. 목표를 입력해 보세요.'}</p>}
  </section>;
}

function MonthCalendar({year,month,selectedDate,tasks,periodGoals,onSelect}){
  const weeklyGoals=weeklyGoalList(periodGoals);
  const firstDay=new Date(year,month-1,1).getDay();
  const days= new Date(year,month,0).getDate();
  return <section className="calendar-card month-calendar-card"><div className="weekdays">{['일','월','화','수','목','금','토'].map((w,i)=><span key={w} className={i===0?'sun':i===6?'sat':''}>{w}</span>)}</div><div className="calendar-grid">{Array.from({length:firstDay},(_,i)=><div key={'blank'+i}/>)}{Array.from({length:days},(_,i)=>{
    const n=i+1,key=`${year}-${String(month).padStart(2,'0')}-${String(n).padStart(2,'0')}`;
    const items=tasks.filter(t=>t.date===key),done=items.length>0&&items.every(t=>t.completed);
    const dayWeekGoals=weeklyGoals.filter(g=>g.start<=key&&g.end>=key);
    return <button key={key} className={`calendar-day month-detail-day ${key===selectedDate?'selected':''} ${key===todayISO()?'today':''}`} onClick={()=>onSelect(key)}>
      <span className="calendar-day-number">{n}</span>
      {items.length>0&&<span className="calendar-subjects">{items.slice(0,2).map((t,j)=><span key={t.id} className={`calendar-subject ${subjectColor[j%subjectColor.length]}`}>{t.title}</span>)}</span>}
      {dayWeekGoals.length>0&&<span className="calendar-week-goal" title={dayWeekGoals.map(g=>g.content).join(' · ')}>주간: {dayWeekGoals[0].content}</span>}
      {items.length>0&&<i className={done?'done-dot':''}/> }
    </button>;
  })}</div><div className="calendar-legend"><span><i/> 공부 기록 있음</span><span><i className="done-dot"/> 모든 목표 완료</span></div></section>;
}

function YearCalendar({year,selectedDate,tasks,periodGoals,onSelectMonth,onSelectDay}){
  return <section className="year-calendar-grid">{Array.from({length:12},(_,i)=>{
    const month=i+1,firstDay=new Date(year,month-1,1).getDay(),days=new Date(year,month,0).getDate();
    const monthGoal=periodGoals[`month:${year}-${String(month).padStart(2,'0')}`]||'';
    return <article className="mini-month" key={month}>
      <button className="mini-month-title" onClick={()=>onSelectMonth(month)}>{month}월 <ChevronRight size={13}/></button>
      <div className={`mini-month-goal ${monthGoal?'has-month-goal':''}`} title={monthGoal||'월간 목표 없음'}>{monthGoal||'월간 목표 없음'}</div>
      <div className="mini-weekdays">{['일','월','화','수','목','금','토'].map((w,j)=><span key={w} className={j===0?'sun':j===6?'sat':''}>{w}</span>)}</div>
      <div className="mini-days">{Array.from({length:firstDay},(_,j)=><span key={`b${j}`}/>)}{Array.from({length:days},(_,j)=>{
        const d=j+1,key=`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`,items=tasks.filter(t=>t.date===key),done=items.length>0&&items.every(t=>t.completed);
        return <button key={key} className={`mini-day ${key===todayISO()?'mini-today':''} ${key===selectedDate?'mini-selected':''} ${items.length?'has-study':''} ${done?'mini-done':''}`} onClick={()=>onSelectDay(key)} title={items.map(t=>`${t.subject||'기타'}: ${t.title}`).join('\n')||key}>{d}</button>;
      })}</div>
    </article>;
  })}</section>;
}

function TaskList({tasks,toggleTask,editTask,deleteTask,showDate=false}){
  if(!tasks.length)return <div className="empty-state"><div className="empty-icon"><Sprout size={25}/></div><strong>아직 등록된 공부가 없어요.</strong><p>추가 버튼을 눌러 공부할 과목과 목표를 기록해 보세요.</p></div>;
  return <div className="task-list">{tasks.map(t=><article className={`task-card ${t.completed?'task-complete':''}`} key={t.id}>
    <button className={`check-circle ${t.completed?'checked':''}`} onClick={()=>toggleTask(t)} aria-label={t.completed?'완료 취소':'완료 표시'}>{t.completed&&<Check size={15}/>}</button>
    <button className="task-main" onClick={()=>editTask(t)}><div className="task-title">{t.title}</div><div className="task-meta">{showDate&&<span>{t.date?.slice(5).replace('-','/')}</span>}{t.subject&&<span className="subject-pill">{t.subject}</span>}<span className={`status-pill ${t.completed?'status-done':''}`}>{t.completed?'완료':'진행 예정'}</span></div>{t.note&&<div className="task-note">{t.note}</div>}</button>
    <button className="delete-btn" onClick={()=>deleteTask(t)} aria-label="삭제"><Trash2 size={15}/></button>
  </article>)}</div>;
}

createRoot(document.getElementById('root')).render(<App/>);
