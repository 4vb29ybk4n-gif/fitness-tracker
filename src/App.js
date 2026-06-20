import { useState, useEffect } from "react";
import { getUserId, setUserId, loadData, saveData, supabase } from "./supabaseClient";

// ── 날짜 유틸 ──────────────────────────────────────────
const DEFAULT_START_DATE = "2026-06-15";
const DEFAULT_END_DATE   = "2026-08-31";
function parseDateStr(s){ const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function fmtDateLabel(dateStr){ const d=parseDateStr(dateStr); return `${d.getMonth()+1}월 ${d.getDate()}일`; }
function toMidnight(d) { const c = new Date(d); c.setHours(0,0,0,0); return c; }
function formatDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function getDaysInMonth(y,m) { return new Date(y,m+1,0).getDate(); }
function getTotalWeeks(startDate,endDate) { return Math.ceil((endDate-startDate)/(7*24*60*60*1000)); }
const DAYS_KO   = ["일","월","화","수","목","금","토"];
const MONTHS_KO = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DAY_KR    = ["일","월","화","수","목","금","토"];

// ── 운동 옵션 ──────────────────────────────────────────
const WEIGHT_OPTIONS = [0,5,7.5,10,12.5,15,17.5,20,22.5,25,27.5,30,32.5,35,40,45,50,55,60,70,80,90,100];
const REP_OPTIONS    = [5,6,8,10,12,15,20,30];
const SET_OPTIONS    = [1,2,3,4,5];
const MIN_OPTIONS    = [10,15,20,25,30,40,45,50,60,75,90];
const SEC_OPTIONS    = [20,30,45,60,90,120,180];
const KM_OPTIONS     = [0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,6,7,8,10];
const KCAL_OPTIONS   = [50,100,150,200,250,300,350,400,500];

const TYPE_OPTIONS = [
  {value:"minutes",   label:"⏱ 시간(분)만 기록"},
  {value:"weight",    label:"무게×횟수×세트"},
  {value:"time_set",  label:"초×세트"},
  {value:"cardio",    label:"분+km (유산소)"},
  {value:"cardio_kcal",label:"분+kcal (직접입력)"},
];

// ── 기본 카테고리 ──────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id:"gym", label:"🏋️ 헬스 기구", color:"#C8A96E", bg:"#2a2a2a",
    items:[
      {id:"leg_press",     name:"레그 프레스",        type:"weight",   defaults:{weight:25,reps:10,sets:3}},
      {id:"hip_abduction", name:"힙 어브덕션",        type:"weight",   defaults:{weight:40,reps:10,sets:3}},
      {id:"lat_pulldown",  name:"랫 풀다운",          type:"weight",   defaults:{weight:20,reps:10,sets:3}},
      {id:"db_row",        name:"덤벨 벤트오버 로우", type:"weight",   defaults:{weight:10,reps:10,sets:3}},
      {id:"plank",         name:"플랭크",             type:"time_set", defaults:{secs:60,sets:3}},
      {id:"chest_press",   name:"체스트 프레스",      type:"weight",   defaults:{weight:20,reps:10,sets:3}},
      {id:"shoulder_press",name:"숄더 프레스",        type:"weight",   defaults:{weight:10,reps:10,sets:3}},
      {id:"leg_curl",      name:"레그 컬",            type:"weight",   defaults:{weight:20,reps:10,sets:3}},
      {id:"squat",         name:"스쿼트",             type:"weight",   defaults:{weight:0,reps:12,sets:3}},
    ]},
  { id:"pilates", label:"🩰 필라테스", color:"#6ec87a", bg:"#1e2a1e",
    items:[
      {id:"reformer",    name:"리포머",       type:"minutes", defaults:{mins:50}},
      {id:"cadillac",    name:"캐딜락",       type:"minutes", defaults:{mins:50}},
      {id:"barrel",      name:"배럴",         type:"minutes", defaults:{mins:50}},
      {id:"chair",       name:"체어",         type:"minutes", defaults:{mins:50}},
      {id:"mat_pilates", name:"매트 필라테스", type:"minutes", defaults:{mins:50}},
      {id:"barre",       name:"바레 클래스",  type:"minutes", defaults:{mins:50}},
    ]},
  { id:"cardio", label:"🔥 유산소", color:"#E85D3D", bg:"#2a1e1a",
    items:[
      {id:"treadmill",  name:"트레드밀",  type:"cardio",      defaults:{mins:20,km:2}},
      {id:"walk",       name:"빠른 걷기", type:"cardio",      defaults:{mins:30,km:2}},
      {id:"bike",       name:"사이클",   type:"cardio_kcal", defaults:{mins:30,kcal:200}},
      {id:"elliptical", name:"일립티컬", type:"cardio_kcal", defaults:{mins:30,kcal:200}},
      {id:"jump_rope",  name:"줄넘기",   type:"minutes",     defaults:{mins:15}},
    ]},
];

const GOALS = {weight:56.4, muscle:25.5, fatMass:11.3, fatPct:20.0};
const INITIAL_INBODY = {date:"2026-06-15",weight:56.4,muscle:23.5,fatMass:13.3,fatPct:23.5,score:74};
const CAT_COLOR_PALETTE = ["#8E7CC3","#5DADE2","#F4D03F","#48C9B0","#EC7063","#AF7AC5","#52BE80"];
const CAT_EMOJI_OPTIONS = ["⭐","🧘","🤸","🚴","🏃","🥊","🏊","⛹️","🤾","🎯"];
const LOADING_MESSAGES = [
  "오늘도 한 걸음 더 나아가볼까요?",
  "몸이 기억하는 노력, 시작해요!",
  "오늘의 나를 응원하는 중이에요",
  "꾸준함이 만드는 변화, 함께해요",
  "목표를 향해 한 걸음씩!",
];

function snap(arr,x){ if(arr.includes(x)) return x; return arr.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a); }

// ── 칼로리 추정 (체중 56kg 기준 MET 근사치) ──────────
const BODY_WEIGHT_KG = 56;
function estimateKcal(type,val){
  if(!val) return 0;
  if(type==="weight"){
    // 근력운동: 세트당 약 0.15kcal/kg/분, 세트당 약 40초 가정
    const minutesActive=(val.sets||1)*(40/60);
    return Math.round(minutesActive*BODY_WEIGHT_KG*0.1);
  }
  if(type==="time_set"){
    const minutesActive=((val.secs||30)*(val.sets||1))/60;
    return Math.round(minutesActive*BODY_WEIGHT_KG*0.08);
  }
  if(type==="minutes"){
    // 필라테스/맨몸운동 MET ≈ 3.5
    return Math.round((val.mins||0)*3.5*BODY_WEIGHT_KG/60);
  }
  if(type==="cardio"){
    // 유산소 MET ≈ 7 (속도 비례 보정)
    const speedFactor=val.km&&val.mins?Math.max(0.7,Math.min(1.6,(val.km/(val.mins/60))/6)):1;
    return Math.round((val.mins||0)*7*speedFactor*BODY_WEIGHT_KG/60);
  }
  if(type==="cardio_kcal"){
    return Math.round(val.kcal||0);
  }
  return 0;
}

function defaultsForType(type){
  if(type==="weight")      return {weight:20,reps:10,sets:3};
  if(type==="time_set")    return {secs:60,sets:3};
  if(type==="minutes")     return {mins:50};
  if(type==="cardio")      return {mins:30,km:3};
  if(type==="cardio_kcal") return {mins:30,kcal:200};
  return {};
}

function summaryText(type,val){
  if(!val) return "";
  if(type==="weight")      return `${val.weight}kg × ${val.reps}회 × ${val.sets}세트`;
  if(type==="time_set")    return `${val.secs}초 × ${val.sets}세트`;
  if(type==="minutes")     return `${val.mins}분`;
  if(type==="cardio")      return `${val.mins}분 / ${val.km}km`;
  if(type==="cardio_kcal") return `${val.mins}분 / ${val.kcal}kcal`;
  return "";
}

// ── 공통 컴포넌트 ──────────────────────────────────────
function ProgressBar({value,color="#C8A96E"}){
  return(
    <div style={{background:"#2a2a2a",borderRadius:8,height:8,overflow:"hidden"}}>
      <div style={{width:`${Math.min(100,Math.max(0,value))}%`,height:"100%",background:color,borderRadius:8,transition:"width 0.6s ease"}}/>
    </div>
  );
}

// ── 인바디 추이 그래프 (순수 SVG) ──────────────────────
function InbodyChart({logs,field,unit,color,goalValue}){
  if(!logs||logs.length<2) return(
    <div style={{fontSize:11,color:"#444",textAlign:"center",padding:"24px 0"}}>측정 기록이 2개 이상일 때 그래프가 표시돼요</div>
  );
  const W=300,H=140,padL=34,padR=14,padT=16,padB=22;
  const values=logs.map(l=>l[field]);
  const allVals=goalValue!=null?[...values,goalValue]:values;
  const minV=Math.min(...allVals), maxV=Math.max(...allVals);
  const range=maxV-minV||1;
  const yPad=range*0.15;
  const yMin=minV-yPad, yMax=maxV+yPad;
  const xStep=(W-padL-padR)/(logs.length-1);
  const xAt=i=>padL+i*xStep;
  const yAt=v=>padT+(H-padT-padB)*(1-(v-yMin)/(yMax-yMin));
  const points=logs.map((l,i)=>`${xAt(i)},${yAt(l[field])}`).join(" ");
  const areaPoints=`${padL},${H-padB} ${points} ${xAt(logs.length-1)},${H-padB}`;
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
      <line x1={padL} y1={padT} x2={padL} y2={H-padB} stroke="#2a2a2a" strokeWidth="1"/>
      <line x1={padL} y1={H-padB} x2={W-padR} y2={H-padB} stroke="#2a2a2a" strokeWidth="1"/>
      {goalValue!=null&&(
        <>
          <line x1={padL} y1={yAt(goalValue)} x2={W-padR} y2={yAt(goalValue)} stroke="#C8A96E" strokeWidth="1" strokeDasharray="4,3" opacity="0.6"/>
          <text x={W-padR} y={yAt(goalValue)-4} fontSize="8" fill="#C8A96E" textAnchor="end">목표 {goalValue}{unit}</text>
        </>
      )}
      <polygon points={areaPoints} fill={color} opacity="0.12"/>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2"/>
      {logs.map((l,i)=>(
        <g key={i}>
          <circle cx={xAt(i)} cy={yAt(l[field])} r={i===logs.length-1?4:3} fill={color}/>
          {(i===0||i===logs.length-1)&&(
            <text x={xAt(i)} y={yAt(l[field])-8} fontSize="9" fill="#f0ece4" textAnchor="middle" fontWeight="700">{l[field]}{unit}</text>
          )}
        </g>
      ))}
      {logs.map((l,i)=>(
        (i===0||i===logs.length-1||logs.length<=4)&&(
          <text key={"d"+i} x={xAt(i)} y={H-padB+14} fontSize="8" fill="#555" textAnchor="middle">{l.date.slice(5)}</text>
        )
      ))}
    </svg>
  );
}

function Stepper({value,options,onChange,unit,color}){
  const idx=options.indexOf(value);
  const canDown=idx>0,canUp=idx<options.length-1;
  const btn=(active)=>({width:28,height:28,borderRadius:6,border:"none",cursor:active?"pointer":"default",
    background:active?color:"#2a2a2a",color:active?"#141414":"#444",
    fontSize:16,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:0});
  return(
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <button style={btn(canDown)} onClick={()=>canDown&&onChange(options[idx-1])}>−</button>
      <div style={{minWidth:42,textAlign:"center",fontSize:14,fontWeight:700,color:"#f0ece4"}}>
        {value}<span style={{fontSize:10,color:"#666",marginLeft:1}}>{unit}</span>
      </div>
      <button style={btn(canUp)} onClick={()=>canUp&&onChange(options[idx+1])}>+</button>
    </div>
  );
}

function ItemControls({type,val,onChange,color}){
  const v=val||{};
  const set=k=>nv=>onChange({...v,[k]:nv});
  if(type==="weight") return(
    <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
      <Stepper value={snap(WEIGHT_OPTIONS,v.weight??20)} options={WEIGHT_OPTIONS} onChange={set("weight")} unit="kg" color={color}/>
      <Stepper value={snap(REP_OPTIONS,v.reps??10)}      options={REP_OPTIONS}    onChange={set("reps")}   unit="회" color={color}/>
      <Stepper value={snap(SET_OPTIONS,v.sets??3)}       options={SET_OPTIONS}    onChange={set("sets")}   unit="세트" color={color}/>
    </div>
  );
  if(type==="time_set") return(
    <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
      <Stepper value={snap(SEC_OPTIONS,v.secs??60)} options={SEC_OPTIONS} onChange={set("secs")} unit="초" color={color}/>
      <Stepper value={snap(SET_OPTIONS,v.sets??3)}  options={SET_OPTIONS} onChange={set("sets")} unit="세트" color={color}/>
    </div>
  );
  if(type==="minutes") return <Stepper value={snap(MIN_OPTIONS,v.mins??50)} options={MIN_OPTIONS} onChange={set("mins")} unit="분" color={color}/>;
  if(type==="cardio") return(
    <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
      <Stepper value={snap(MIN_OPTIONS,v.mins??30)} options={MIN_OPTIONS} onChange={set("mins")} unit="분" color={color}/>
      <Stepper value={snap(KM_OPTIONS,v.km??3)}     options={KM_OPTIONS}  onChange={set("km")}  unit="km" color={color}/>
    </div>
  );
  if(type==="cardio_kcal") return(
    <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
      <Stepper value={snap(MIN_OPTIONS,v.mins??30)}   options={MIN_OPTIONS}  onChange={set("mins")} unit="분"   color={color}/>
      <Stepper value={snap(KCAL_OPTIONS,v.kcal??200)} options={KCAL_OPTIONS} onChange={set("kcal")} unit="kcal" color={color}/>
    </div>
  );
  return null;
}

// ── 사용자 ID 모달 (기기간 동기화용) ──────────────────
function UserIdModal({userId,onSave,onClose}){
  const [val,setVal]=useState(userId);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:340,background:"#1a1a1a",borderRadius:16,padding:20}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:10,color:"#f0ece4"}}>🔗 내 코드로 기기 연결</div>
        <div style={{fontSize:12,color:"#888",marginBottom:14,lineHeight:1.6}}>
          이 코드를 다른 기기에서도 똑같이 입력하면 같은 기록을 볼 수 있어요. 코드는 꼭 저장해두세요!
        </div>
        <input value={val} onChange={e=>setVal(e.target.value)}
          style={{width:"100%",background:"#2a2a2a",border:"1px solid #333",borderRadius:8,padding:"10px",color:"#C8A96E",fontSize:14,fontWeight:700,boxSizing:"border-box",marginBottom:14,textAlign:"center"}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>onSave(val)} style={{flex:1,background:"#C8A96E",color:"#141414",border:"none",borderRadius:8,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>적용</button>
          <button onClick={onClose} style={{background:"#2a2a2a",color:"#888",border:"none",borderRadius:8,padding:"12px 16px",fontSize:13,cursor:"pointer"}}>닫기</button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 앱 ───────────────────────────────────────────
export default function FitnessTracker(){
  const today    = toMidnight(new Date());
  const todayStr = formatDate(today);

  const [userId,setUserIdState]          = useState(getUserId());
  const [showUserIdModal,setShowUserIdModal] = useState(false);
  const [dateRange,setDateRange]         = useState({start:DEFAULT_START_DATE,end:DEFAULT_END_DATE});
  const [showDateForm,setShowDateForm]   = useState(false);
  const [editDateRange,setEditDateRange] = useState({start:DEFAULT_START_DATE,end:DEFAULT_END_DATE});
  const [tab,setTab]                     = useState("calendar");
  const [viewMonth,setViewMonth]         = useState({year:today.getFullYear(),month:today.getMonth()});
  const [calSelected,setCalSelected]     = useState(null);
  const [workoutLog,setWorkoutLog]       = useState({});
  const [categories,setCategories]       = useState(DEFAULT_CATEGORIES);
  const [inbodyLogs,setInbodyLogs]       = useState([INITIAL_INBODY]);
  const [expandedCat,setExpandedCat]     = useState({gym:false,pilates:false,cardio:false});
  const [openItem,setOpenItem]           = useState(null);
  const [newInbody,setNewInbody]         = useState({date:todayStr,weight:"",muscle:"",fatMass:"",fatPct:"",score:""});
  const [showInbodyForm,setShowInbodyForm] = useState(false);
  const [showGoalForm,setShowGoalForm]     = useState(false);
  const [goals,setGoals]                   = useState(GOALS);
  const [baseInbody,setBaseInbody]         = useState(INITIAL_INBODY);
  const [editGoal,setEditGoal]             = useState({muscle:"",fatMass:"",fatPct:""});
  const [editBase,setEditBase]             = useState({date:"",weight:"",muscle:"",fatMass:"",fatPct:"",score:""});
  const [inlineEdit,setInlineEdit]       = useState(null);
  const [newItemName,setNewItemName]     = useState("");
  const [newItemType,setNewItemType]     = useState("minutes");
  const [showCatForm,setShowCatForm]     = useState(false);
  const [newCatName,setNewCatName]       = useState("");
  const [newCatEmoji,setNewCatEmoji]     = useState("⭐");
  const [newCatColor,setNewCatColor]     = useState("#8E7CC3");
  const [loaded,setLoaded]               = useState(false);
  const [saveMsg,setSaveMsg]             = useState("");
  const [workoutDate,setWorkoutDate]     = useState(todayStr);
  const [nickname,setNickname]           = useState("");
  const [myGroups,setMyGroups]           = useState([]); // [{code, joinedAt}]
  const [activeGroupCode,setActiveGroupCode] = useState("");
  const [showGroupModal,setShowGroupModal] = useState(false);
  const [groupInput,setGroupInput]       = useState("");
  const [nicknameInput,setNicknameInput] = useState("");
  const [groupMembers,setGroupMembers]   = useState([]);
  const [groupLoading,setGroupLoading]   = useState(false);
  const [groupEndDate,setGroupEndDate]   = useState("");
  const [groupEndInput,setGroupEndInput] = useState("");
  const [showCreateGroupForm,setShowCreateGroupForm] = useState(false);
  const [showAddGroupForm,setShowAddGroupForm] = useState(false);

  // ── 클라우드에서 불러오기 ──────────────────────────
  const START_DATE = parseDateStr(dateRange.start);
  const END_DATE   = parseDateStr(dateRange.end);

  useEffect(()=>{
    async function load(){
      const w   = await loadData(userId,"workoutLog",{});
      const ib  = await loadData(userId,"inbodyLogs",[INITIAL_INBODY]);
      const cats= await loadData(userId,"categories",DEFAULT_CATEGORIES);
      const g   = await loadData(userId,"goals",GOALS);
      const b   = await loadData(userId,"baseInbody",INITIAL_INBODY);
      const dr  = await loadData(userId,"dateRange",{start:DEFAULT_START_DATE,end:DEFAULT_END_DATE});
      const nick= await loadData(userId,"nickname","");
      const grps= await loadData(userId,"myGroups",[]);
      const active=await loadData(userId,"activeGroupCode","");
      setWorkoutLog(w||{});
      setInbodyLogs(ib&&ib.length?ib:[INITIAL_INBODY]);
      setCategories(cats&&cats.length?cats:DEFAULT_CATEGORIES);
      setGoals(g||GOALS);
      setBaseInbody(b||INITIAL_INBODY);
      setDateRange(dr&&dr.start&&dr.end?dr:{start:DEFAULT_START_DATE,end:DEFAULT_END_DATE});
      setNickname(nick||"");
      setMyGroups(grps&&grps.length?grps:[]);
      setActiveGroupCode(active||(grps&&grps.length?grps[0].code:""));
      setLoaded(true);
    }
    load();
  },[userId]);

  function flash(msg){setSaveMsg(msg);setTimeout(()=>setSaveMsg(""),1500);}

  async function persistWorkout(next){
    const ok = await saveData(userId,"workoutLog",next);
    flash(ok?"저장됨 ✓":"저장 실패");
  }
  async function persistInbody(next){
    const ok = await saveData(userId,"inbodyLogs",next);
    flash(ok?"저장됨 ✓":"저장 실패");
  }
  async function persistCats(next){
    const ok = await saveData(userId,"categories",next);
    flash(ok?"저장됨 ✓":"저장 실패");
  }
  async function persistGoals(g,b){
    await saveData(userId,"goals",g);
    await saveData(userId,"baseInbody",b);
    flash("저장됨 ✓");
  }
  async function persistDateRange(dr){
    const ok = await saveData(userId,"dateRange",dr);
    flash(ok?"저장됨 ✓":"저장 실패");
  }

  function updateDayLog(dateKey,updater){
    setWorkoutLog(prev=>{
      const next={...prev};
      if(!next[dateKey]) next[dateKey]={checks:{},values:{},memo:""};
      next[dateKey]=updater(next[dateKey]);
      persistWorkout(next);
      return next;
    });
  }

  function toggleCheck(dateKey,catId,itemId,defaults){
    const key=`${catId}_${itemId}`;
    updateDayLog(dateKey,dl=>{
      const nowChecked=!dl.checks[key];
      const newValues={...dl.values};
      if(nowChecked&&!newValues[key]) newValues[key]={...defaults};
      return {...dl,checks:{...dl.checks,[key]:nowChecked},values:newValues};
    });
  }
  function setVal(dateKey,catId,itemId,val){
    const key=`${catId}_${itemId}`;
    updateDayLog(dateKey,dl=>({...dl,values:{...dl.values,[key]:val}}));
  }
  function saveMemo(dateKey,val){updateDayLog(dateKey,dl=>({...dl,memo:val}));}

  function toggleCatForDate(dateKey,catId){
    // 달력에서는 전체 체크하지 않고, 운동탭으로 이동 + 해당 카테고리 펼치기만 함
    setExpandedCat(prev=>({...prev,[catId]:true}));
    setWorkoutDate(dateKey);
    setTab("workout");
  }

  function addInbody(){
    if(!newInbody.date||!newInbody.weight) return;
    const next=[...inbodyLogs,{date:newInbody.date,weight:parseFloat(newInbody.weight)||0,
      muscle:parseFloat(newInbody.muscle)||0,fatMass:parseFloat(newInbody.fatMass)||0,
      fatPct:parseFloat(newInbody.fatPct)||0,score:parseInt(newInbody.score)||0,
    }].sort((a,b)=>a.date.localeCompare(b.date));
    setInbodyLogs(next); persistInbody(next);
    setNewInbody({date:todayStr,weight:"",muscle:"",fatMass:"",fatPct:"",score:""});
    setShowInbodyForm(false);
  }

  function saveCategories(cats){
    setCategories(cats); persistCats(cats);
    setExpandedCat(prev=>Object.fromEntries(cats.map(c=>[c.id,prev[c.id]??false])));
  }

  function addCategory(){
    if(!newCatName.trim()) return;
    const newCat={id:"cat_"+Date.now(),label:`${newCatEmoji} ${newCatName.trim()}`,color:newCatColor,bg:"#1e1e1e",items:[]};
    const next=[...categories,newCat];
    saveCategories(next);
    setExpandedCat(prev=>({...prev,[newCat.id]:true}));
    setNewCatName(""); setNewCatEmoji("⭐"); setNewCatColor("#8E7CC3");
    setShowCatForm(false);
  }

  function deleteCategory(catId){
    const next=categories.filter(c=>c.id!==catId);
    saveCategories(next);
  }

  function getDayKcal(dateStr){
    const dl=workoutLog[dateStr]; if(!dl) return 0;
    let total=0;
    categories.forEach(cat=>{
      cat.items.forEach(it=>{
        const key=`${cat.id}_${it.id}`;
        if(dl.checks?.[key]){
          const val=dl.values?.[key]||it.defaults;
          total+=estimateKcal(it.type,val);
        }
      });
    });
    return total;
  }

  function handleUserIdSave(newId){
    setUserId(newId);
    setUserIdState(newId);
    setShowUserIdModal(false);
    setLoaded(false);
  }

  // ── 달력 ────────────────────────────────────────────
  const {year,month}=viewMonth;
  const daysInMonth=getDaysInMonth(year,month);
  const firstDay=new Date(year,month,1).getDay();
  const totalDays=Math.round((END_DATE-START_DATE)/(24*60*60*1000))+1;
  const totalItems=categories.reduce((a,c)=>a+c.items.length,0);

  function getDayCheckedCount(dateStr){
    const dl=workoutLog[dateStr]; if(!dl) return 0;
    return Object.values(dl.checks||{}).filter(Boolean).length;
  }
  

  function hasCatActivity(dateStr,catId){
    const dl=workoutLog[dateStr]; if(!dl) return false;
    const cat=categories.find(c=>c.id===catId);
    return cat?.items.some(it=>dl.checks?.[`${catId}_${it.id}`])||false;
  }

  function getWeekCount(catId){
    const weekStart=new Date(today); weekStart.setDate(today.getDate()-today.getDay());
    let count=0;
    for(let i=0;i<7;i++){const d=new Date(weekStart);d.setDate(weekStart.getDate()+i);if(hasCatActivity(formatDate(d),catId))count++;}
    return count;
  }

  const totalWorkoutDays=Object.keys(workoutLog).filter(k=>{
    const d=toMidnight(new Date(k+"T00:00:00"));
    return d>=START_DATE&&d<=END_DATE&&getDayCheckedCount(k)>0;
  }).length;
  const progressPct=Math.min(100,Math.round((totalWorkoutDays/totalDays)*100));

  function getCheerMessage(days){
    if(days===0) return "오늘부터 시작해봐요! 💪";
    if(days<3) return "좋은 시작이에요! 🌱";
    if(days<7) return "꾸준함이 보여요! 👏";
    if(days<14) return "벌써 일주일 넘게! 멋져요 🔥";
    if(days<21) return "습관이 되어가고 있어요! ✨";
    if(days<30) return "한 달 가까이! 대단해요 🎯";
    if(days<45) return "이 정도면 진짜 루틴이에요 🏆";
    return "완전 갓생이에요! 정말 자랑스러워요 👑";
  }
  const cheerMsg=getCheerMessage(totalWorkoutDays);

  const latest=inbodyLogs[inbodyLogs.length-1];
  const muscleProgress=latest?((latest.muscle-baseInbody.muscle)/(goals.muscle-baseInbody.muscle))*100:0;
  const fatProgress=latest?((baseInbody.fatMass-latest.fatMass)/(baseInbody.fatMass-goals.fatMass))*100:0;
  const fatPctProgress=latest?((baseInbody.fatPct-latest.fatPct)/(baseInbody.fatPct-goals.fatPct))*100:0;

  const calendarCells=[];
  for(let i=0;i<firstDay;i++) calendarCells.push(null);
  for(let d=1;d<=daysInMonth;d++) calendarCells.push(d);
  function isInRange(d){const date=new Date(year,month,d);return date>=START_DATE&&date<=END_DATE;}

  const weekGym=getWeekCount("gym");
  const weekPilates=getWeekCount("pilates");

  // ── 그룹 경쟁 동기화 ──────────────────────────────────
  useEffect(()=>{
    if(!activeGroupCode||!nickname) return;
    const myKcal=getDayKcal(todayStr);
    const payload={nickname,weekGym,weekPilates,todayKcal:myKcal,totalWorkoutDays,updatedAt:Date.now()};
    saveData(userId,"group_"+activeGroupCode+"_"+userId,payload);
  },[activeGroupCode,nickname,weekGym,weekPilates,workoutLog,totalWorkoutDays,userId]);

  async function refreshGroupMembers(){
    if(!activeGroupCode) return;
    setGroupLoading(true);
    try{
      const { data, error } = await supabase
        .from("fitness_data")
        .select("data_value,user_id")
        .like("data_key","group_"+activeGroupCode+"_%");
      if(!error&&data){
        const members=data.map(row=>({...row.data_value,isMe:row.user_id===userId}))
          .filter(m=>m.nickname);
        setGroupMembers(members);
      }
      const endData=await loadData("shared_group_meta",activeGroupCode+"_endDate","");
      setGroupEndDate(endData||"");
    }catch(e){ console.error("group fetch error",e); }
    setGroupLoading(false);
  }

  useEffect(()=>{
    if(!activeGroupCode) return;
    refreshGroupMembers();
    const interval=setInterval(refreshGroupMembers,15000);
    return ()=>clearInterval(interval);
  },[activeGroupCode]);

  async function persistMyGroups(next){
    setMyGroups(next);
    await saveData(userId,"myGroups",next);
  }

  // 새 그룹 만들기: 코드를 직접 정하고, 종료일도 같이 세팅 (그룹 기본값)
  async function createGroup(){
    if(!groupInput.trim()||!nicknameInput.trim()) return;
    const code=groupInput.trim().toUpperCase();
    const nick=nicknameInput.trim();
    if(myGroups.some(g=>g.code===code)){ flash("이미 가입된 그룹이에요"); return; }
    const nextGroups=[...myGroups,{code,joinedAt:Date.now()}];
    setNickname(nick);
    await saveData(userId,"nickname",nick);
    await persistMyGroups(nextGroups);
    setActiveGroupCode(code);
    await saveData(userId,"activeGroupCode",code);
    if(groupEndInput){
      await saveData("shared_group_meta",code+"_endDate",groupEndInput);
    }
    setShowGroupModal(false); setShowCreateGroupForm(false); setShowAddGroupForm(false);
    setGroupInput(""); setNicknameInput(""); setGroupEndInput("");
    flash("새 그룹 생성 완료 ✓");
  }

  // 기존 그룹 참여: 코드만 입력하면 그 그룹의 기존 설정(종료일)을 그대로 따름
  async function joinGroup(){
    if(!groupInput.trim()||!nicknameInput.trim()) return;
    const code=groupInput.trim().toUpperCase();
    const nick=nicknameInput.trim();
    if(myGroups.some(g=>g.code===code)){ flash("이미 가입된 그룹이에요"); return; }
    const nextGroups=[...myGroups,{code,joinedAt:Date.now()}];
    setNickname(nick);
    await saveData(userId,"nickname",nick);
    await persistMyGroups(nextGroups);
    setActiveGroupCode(code);
    await saveData(userId,"activeGroupCode",code);
    setShowGroupModal(false); setShowAddGroupForm(false);
    setGroupInput(""); setNicknameInput("");
    flash("그룹 참여 완료 ✓");
  }

  async function switchActiveGroup(code){
    setActiveGroupCode(code);
    await saveData(userId,"activeGroupCode",code);
  }

  async function leaveGroup(code){
    await saveData(userId,"group_"+code+"_"+userId,null);
    const nextGroups=myGroups.filter(g=>g.code!==code);
    await persistMyGroups(nextGroups);
    if(activeGroupCode===code){
      const nextActive=nextGroups.length?nextGroups[0].code:"";
      setActiveGroupCode(nextActive);
      await saveData(userId,"activeGroupCode",nextActive);
      setGroupMembers([]);
      setGroupEndDate("");
    }
  }

  async function saveGroupEndDate(){
    if(!groupEndInput||!activeGroupCode) return;
    await saveData("shared_group_meta",activeGroupCode+"_endDate",groupEndInput);
    setGroupEndDate(groupEndInput);
    setGroupEndInput("");
    flash("목표 기간 설정 완료 ✓");
  }

  async function shareGroup(){
    const shareText=`"${activeGroupCode}" 그룹에서 같이 운동해요! 피트니스 트래커 앱에서 그룹 코드 "${activeGroupCode}"를 입력하고 참여하세요 💪`;
    if(navigator.share){
      try{ await navigator.share({title:"운동 그룹 초대",text:shareText}); }
      catch(e){ /* 사용자가 취소한 경우 무시 */ }
    }else if(navigator.clipboard){
      try{ await navigator.clipboard.writeText(shareText); flash("초대 문구 복사됨 ✓"); }
      catch(e){ flash("복사 실패"); }
    }
  }

  const weekDates=Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()-3+i);return formatDate(d);});
  function fmtShort(ds){const d=new Date(ds+"T00:00:00");return `${d.getMonth()+1}/${d.getDate()} (${DAY_KR[d.getDay()]})`;}

  const dayLog=workoutLog[workoutDate]||{checks:{},values:{},memo:""};
  

  if(!loaded) return(
    <div style={{minHeight:"100vh",background:"#141414",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#C8A96E",fontSize:15,gap:10}}>
      <div style={{fontSize:28}}>💪</div>
      <div style={{fontWeight:700}}>{LOADING_MESSAGES[Math.floor(Math.random()*LOADING_MESSAGES.length)]}</div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"#141414",color:"#f0ece4",fontFamily:"'Apple SD Gothic Neo',sans-serif",paddingBottom:80}}>

      {saveMsg&&<div style={{position:"fixed",top:16,right:16,background:saveMsg.includes("실패")?"#E85D3D":"#6ec87a",color:"#141414",padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:700,zIndex:998}}>{saveMsg}</div>}

      {showUserIdModal&&<UserIdModal userId={userId} onSave={handleUserIdSave} onClose={()=>setShowUserIdModal(false)}/>}

      {showDateForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{width:"100%",maxWidth:340,background:"#1a1a1a",borderRadius:16,padding:20}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:14,color:"#f0ece4"}}>📅 목표 기간 수정</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#888",marginBottom:6}}>시작일</div>
              <input type="date" value={editDateRange.start} onChange={e=>setEditDateRange(p=>({...p,start:e.target.value}))}
                style={{width:"100%",background:"#2a2a2a",border:"1px solid #333",borderRadius:8,padding:"10px",color:"#f0ece4",fontSize:14,boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:18}}>
              <div style={{fontSize:11,color:"#888",marginBottom:6}}>종료일 (목표일)</div>
              <input type="date" value={editDateRange.end} onChange={e=>setEditDateRange(p=>({...p,end:e.target.value}))}
                style={{width:"100%",background:"#2a2a2a",border:"1px solid #333",borderRadius:8,padding:"10px",color:"#f0ece4",fontSize:14,boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{
                if(!editDateRange.start||!editDateRange.end) return;
                const next={start:editDateRange.start,end:editDateRange.end};
                setDateRange(next);
                persistDateRange(next);
                setShowDateForm(false);
              }} style={{flex:1,background:"#C8A96E",color:"#141414",border:"none",borderRadius:8,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>저장</button>
              <button onClick={()=>setShowDateForm(false)} style={{background:"#2a2a2a",color:"#888",border:"none",borderRadius:8,padding:"12px 16px",fontSize:13,cursor:"pointer"}}>취소</button>
            </div>
          </div>
        </div>
      )}

      {showGroupModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{width:"100%",maxWidth:360,background:"#1a1a1a",borderRadius:16,padding:20,maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:4,color:"#f0ece4"}}>🏆 그룹 경쟁</div>
            <div style={{fontSize:11,color:"#666",marginBottom:16,lineHeight:1.6}}>
              친구와 같은 그룹 코드로 모이면 서로의 주간 운동 횟수와 칼로리를 비교할 수 있어요.
            </div>

            {(myGroups.length===0||showAddGroupForm)?(
              <>
                <div style={{display:"flex",gap:6,marginBottom:14}}>
                  <button onClick={()=>setShowCreateGroupForm(false)} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",background:!showCreateGroupForm?"#C8A96E":"#2a2a2a",color:!showCreateGroupForm?"#141414":"#888",fontWeight:!showCreateGroupForm?700:400,fontSize:12}}>기존 그룹 참여</button>
                  <button onClick={()=>setShowCreateGroupForm(true)} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",background:showCreateGroupForm?"#C8A96E":"#2a2a2a",color:showCreateGroupForm?"#141414":"#888",fontWeight:showCreateGroupForm?700:400,fontSize:12}}>새 그룹 만들기</button>
                </div>
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:"#888",marginBottom:6}}>닉네임</div>
                  <input value={nicknameInput} onChange={e=>setNicknameInput(e.target.value)}
                    placeholder="예: 지큐" maxLength={10}
                    style={{width:"100%",background:"#2a2a2a",border:"1px solid #333",borderRadius:8,padding:"10px",color:"#f0ece4",fontSize:14,boxSizing:"border-box"}}/>
                </div>
                <div style={{marginBottom:showCreateGroupForm?12:18}}>
                  <div style={{fontSize:11,color:"#888",marginBottom:6}}>{showCreateGroupForm?"새 그룹 코드 (직접 정하기)":"그룹 코드 (친구와 동일하게)"}</div>
                  <input value={groupInput} onChange={e=>setGroupInput(e.target.value.toUpperCase())}
                    placeholder="예: A그룹 또는 ABC123" maxLength={12}
                    style={{width:"100%",background:"#2a2a2a",border:"1px solid #333",borderRadius:8,padding:"10px",color:"#C8A96E",fontSize:14,fontWeight:700,boxSizing:"border-box",textAlign:"center"}}/>
                </div>
                {showCreateGroupForm&&(
                  <div style={{marginBottom:18}}>
                    <div style={{fontSize:11,color:"#888",marginBottom:6}}>목표 종료일 (그룹 기본 설정, 선택)</div>
                    <input type="date" value={groupEndInput} onChange={e=>setGroupEndInput(e.target.value)}
                      style={{width:"100%",background:"#2a2a2a",border:"1px solid #333",borderRadius:8,padding:"10px",color:"#f0ece4",fontSize:13,boxSizing:"border-box"}}/>
                    <div style={{fontSize:10,color:"#555",marginTop:4}}>여기서 설정한 종료일이 그룹의 기본값이 되어, 나중에 참여하는 친구들도 똑같이 적용돼요.</div>
                  </div>
                )}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={showCreateGroupForm?createGroup:joinGroup} style={{flex:1,background:"#C8A96E",color:"#141414",border:"none",borderRadius:8,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                    {showCreateGroupForm?"그룹 만들기":"참여하기"}
                  </button>
                  <button onClick={()=>{
                    if(myGroups.length>0){ setShowAddGroupForm(false); }
                    else{ setShowGroupModal(false); }
                  }} style={{background:"#2a2a2a",color:"#888",border:"none",borderRadius:8,padding:"12px 16px",fontSize:13,cursor:"pointer"}}>취소</button>
                </div>
              </>
            ):(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,padding:"8px 12px",background:"#2a2a2a",borderRadius:8}}>
                  <span style={{fontSize:12,color:"#888"}}>내 닉네임: <b style={{color:"#f0ece4"}}>{nickname}</b></span>
                  <button onClick={refreshGroupMembers} style={{background:"none",border:"none",color:"#C8A96E",fontSize:11,cursor:"pointer"}}>🔄 새로고침</button>
                </div>

                {/* 그룹 전환 탭 */}
                <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                  {myGroups.map(g=>(
                    <button key={g.code} onClick={()=>switchActiveGroup(g.code)} style={{
                      padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                      background:activeGroupCode===g.code?"#C8A96E":"#2a2a2a",
                      color:activeGroupCode===g.code?"#141414":"#888",
                    }}>{g.code}</button>
                  ))}
                  <button onClick={()=>{setShowAddGroupForm(true);setShowCreateGroupForm(false);setGroupInput("");setNicknameInput(nickname);}}
                    style={{padding:"6px 12px",borderRadius:8,border:"1px dashed #444",cursor:"pointer",fontSize:12,color:"#666",background:"transparent"}}>
                    ＋ 다른 그룹
                  </button>
                </div>

                {/* 목표 기간 설정 */}
                {groupEndDate?(
                  (()=>{
                    const endD=parseDateStr(groupEndDate);
                    const dday=Math.ceil((endD-today)/86400000);
                    const isFinished=dday<0;
                    return(
                      <div style={{marginBottom:16,padding:"10px 12px",background:isFinished?"#2a1e1a":"rgba(200,169,110,0.1)",border:`1px solid ${isFinished?"#5a2a2a":"#C8A96E"}33`,borderRadius:8,textAlign:"center"}}>
                        <div style={{fontSize:12,color:isFinished?"#E85D3D":"#C8A96E",fontWeight:700}}>
                          {isFinished?"🏁 경쟁 기간 종료!":`⏳ D${dday===0?"-Day":dday>0?"-"+dday:"+"+(-dday)}`}
                        </div>
                        <div style={{fontSize:10,color:"#666",marginTop:2}}>목표일: {groupEndDate}</div>
                      </div>
                    );
                  })()
                ):(
                  <div style={{marginBottom:16,padding:"10px 12px",background:"#222",borderRadius:8}}>
                    <div style={{fontSize:11,color:"#888",marginBottom:6}}>그룹 경쟁 종료일 설정 (선택)</div>
                    <div style={{display:"flex",gap:6}}>
                      <input type="date" value={groupEndInput} onChange={e=>setGroupEndInput(e.target.value)}
                        style={{flex:1,background:"#2a2a2a",border:"1px solid #333",borderRadius:6,padding:"7px 8px",color:"#f0ece4",fontSize:12,boxSizing:"border-box"}}/>
                      <button onClick={saveGroupEndDate} style={{background:"#C8A96E",color:"#141414",border:"none",borderRadius:6,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>설정</button>
                    </div>
                  </div>
                )}

                {groupEndDate&&Math.ceil((parseDateStr(groupEndDate)-today)/86400000)<0&&(
                  <div style={{marginBottom:18}}>
                    <div style={{fontSize:12,color:"#C8A96E",letterSpacing:1,marginBottom:8,fontWeight:700}}>🏆 최종 종합 랭킹 (누적 운동일수)</div>
                    {[...groupMembers].sort((a,b)=>(b.totalWorkoutDays||0)-(a.totalWorkoutDays||0)).map((m,i)=>(
                      <div key={"f"+i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:i===0?"rgba(200,169,110,0.2)":m.isMe?"rgba(200,169,110,0.1)":"#222",borderRadius:8,marginBottom:4,border:i===0?"1px solid #C8A96E":"none"}}>
                        <span style={{fontSize:14,color:i===0?"#C8A96E":m.isMe?"#f0ece4":"#ccc",fontWeight:i===0||m.isMe?700:400}}>
                          {i===0?"👑":i===1?"🥈":i===2?"🥉":`${i+1}.`} {m.nickname}{m.isMe?" (나)":""}
                        </span>
                        <span style={{fontSize:14,color:"#C8A96E",fontWeight:700}}>{m.totalWorkoutDays||0}일</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{fontSize:11,color:"#C8A96E",letterSpacing:1,marginBottom:8,fontWeight:700}}>🔥 오늘 칼로리 랭킹</div>
                {[...groupMembers].sort((a,b)=>(b.todayKcal||0)-(a.todayKcal||0)).map((m,i)=>(
                  <div key={"k"+i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:m.isMe?"rgba(200,169,110,0.15)":"transparent",borderRadius:8,marginBottom:2}}>
                    <span style={{fontSize:13,color:m.isMe?"#C8A96E":"#ccc",fontWeight:m.isMe?700:400}}>
                      {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`} {m.nickname}{m.isMe?" (나)":""}
                    </span>
                    <span style={{fontSize:13,color:"#E85D3D",fontWeight:700}}>{m.todayKcal||0} kcal</span>
                  </div>
                ))}

                <div style={{fontSize:11,color:"#C8A96E",letterSpacing:1,margin:"16px 0 8px",fontWeight:700}}>📅 이번주 운동 횟수 랭킹</div>
                {[...groupMembers].sort((a,b)=>((b.weekGym||0)+(b.weekPilates||0))-((a.weekGym||0)+(a.weekPilates||0))).map((m,i)=>(
                  <div key={"w"+i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:m.isMe?"rgba(200,169,110,0.15)":"transparent",borderRadius:8,marginBottom:2}}>
                    <span style={{fontSize:13,color:m.isMe?"#C8A96E":"#ccc",fontWeight:m.isMe?700:400}}>
                      {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`} {m.nickname}{m.isMe?" (나)":""}
                    </span>
                    <span style={{fontSize:12,color:"#888"}}>헬스 {m.weekGym||0}회 · 필라테스 {m.weekPilates||0}회</span>
                  </div>
                ))}

                <div style={{fontSize:11,color:"#555",letterSpacing:1,margin:"16px 0 8px",fontWeight:600}}>📊 기간 중 누적 운동일수</div>
                {[...groupMembers].sort((a,b)=>(b.totalWorkoutDays||0)-(a.totalWorkoutDays||0)).map((m,i)=>(
                  <div key={"t"+i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:m.isMe?"rgba(200,169,110,0.15)":"transparent",borderRadius:8,marginBottom:2}}>
                    <span style={{fontSize:13,color:m.isMe?"#C8A96E":"#ccc",fontWeight:m.isMe?700:400}}>
                      {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`} {m.nickname}{m.isMe?" (나)":""}
                    </span>
                    <span style={{fontSize:13,color:"#888"}}>{m.totalWorkoutDays||0}일</span>
                  </div>
                ))}

                {groupMembers.length<=1&&(
                  <div style={{fontSize:11,color:"#555",textAlign:"center",padding:"16px 0"}}>아직 그룹에 친구가 없어요. 아래 공유 버튼으로 초대해보세요!</div>
                )}
                {groupLoading&&<div style={{fontSize:10,color:"#444",textAlign:"center",marginTop:8}}>불러오는 중...</div>}

                <button onClick={shareGroup} style={{width:"100%",marginTop:14,background:"#2a2a2a",border:"1px solid #C8A96E",color:"#C8A96E",borderRadius:8,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  📤 "{activeGroupCode}" 그룹 친구 초대 공유하기
                </button>

                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <button onClick={()=>leaveGroup(activeGroupCode)} style={{background:"#3a1a1a",border:"1px solid #5a2a2a",color:"#E85D3D",borderRadius:8,padding:"10px 14px",fontSize:12,cursor:"pointer"}}>이 그룹 나가기</button>
                  <button onClick={()=>setShowGroupModal(false)} style={{flex:1,background:"#2a2a2a",color:"#888",border:"none",borderRadius:8,padding:"10px",fontSize:13,cursor:"pointer"}}>닫기</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{background:"linear-gradient(135deg,#1a1a1a,#222)",borderBottom:"1px solid #2a2a2a",padding:"36px 20px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{fontSize:11,letterSpacing:3,color:"#C8A96E",marginBottom:6,textTransform:"uppercase"}}>My Fitness Journey</div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{setEditDateRange(dateRange);setShowDateForm(true);}} style={{background:"#2a2a2a",border:"1px solid #333",borderRadius:8,color:"#888",padding:"5px 10px",fontSize:10,cursor:"pointer"}}>
              📅 기간 수정
            </button>
            <button onClick={()=>setShowUserIdModal(true)} style={{background:"#2a2a2a",border:"1px solid #333",borderRadius:8,color:"#888",padding:"5px 10px",fontSize:10,cursor:"pointer"}}>
              🔗 기기 연결
            </button>
            <button onClick={()=>{setGroupInput("");setNicknameInput(nickname);setShowGroupModal(true);}} style={{background:activeGroupCode?"#C8A96E":"#2a2a2a",border:"1px solid #333",borderRadius:8,color:activeGroupCode?"#141414":"#888",padding:"5px 10px",fontSize:10,cursor:"pointer",fontWeight:activeGroupCode?700:400}}>
              🏆 {activeGroupCode?activeGroupCode+(myGroups.length>1?` +${myGroups.length-1}`:""):"그룹 경쟁"}
            </button>
          </div>
        </div>
        <div style={{fontSize:22,fontWeight:700,marginBottom:16}}>{fmtDateLabel(dateRange.start)} → {fmtDateLabel(dateRange.end)}</div>
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#888",marginBottom:6}}>
            <span>목표까지</span>
            <span style={{color:"#C8A96E"}}>{Math.round(progressPct)}% 진행</span>
          </div>
          <ProgressBar value={progressPct}/>
        </div>
        <div style={{fontSize:11,color:"#555",marginTop:4}}>D+{Math.max(0,Math.floor((today-START_DATE)/86400000))} · 총 {totalDays}일 중</div>
        <div style={{marginTop:10,display:"inline-block",background:"rgba(200,169,110,0.12)",border:"1px solid rgba(200,169,110,0.3)",borderRadius:20,padding:"6px 14px",fontSize:12,color:"#C8A96E",fontWeight:600}}>
          {cheerMsg} · 누적 {totalWorkoutDays}일
        </div>
      </div>

      {/* 통계 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:1,background:"#222",borderBottom:"1px solid #2a2a2a"}}>
        {[
          {label:"이번주 헬스",    value:`${weekGym}회`,         sub:"목표 3회", color:weekGym>=3?"#6ec87a":"#C8A96E"},
          {label:"이번주 필라테스", value:`${weekPilates}회`,     sub:"목표 2회", color:weekPilates>=2?"#6ec87a":"#C8A96E"},
          {label:"누적 운동일",    value:`${totalWorkoutDays}일`, sub:`목표 ${getTotalWeeks(START_DATE,END_DATE)*3}일`, color:"#C8A96E"},
          {label:"오늘 칼로리",    value:`${getDayKcal(todayStr)}`, sub:"kcal", color:getDayKcal(todayStr)>0?"#E85D3D":"#555"},
        ].map((s,i)=>(
          <div key={i} style={{background:"#1a1a1a",padding:"14px 8px",textAlign:"center"}}>
            <div style={{fontSize:9,color:"#555",marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:18,fontWeight:700,color:s.color}}>{s.value}</div>
            <div style={{fontSize:9,color:"#444",marginTop:2}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div style={{display:"flex",borderBottom:"1px solid #2a2a2a",background:"#1a1a1a"}}>
        {[["calendar","📅 달력"],["workout","🏋️ 운동"],["inbody","💪 인바디"]].map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key)} style={{
            flex:1,padding:"13px 0",fontSize:12,fontWeight:tab===key?700:400,
            color:tab===key?"#C8A96E":"#555",background:"none",border:"none",
            borderBottom:tab===key?"2px solid #C8A96E":"2px solid transparent",cursor:"pointer"
          }}>{label}</button>
        ))}
      </div>

      {/* ══ 달력 탭 ══ */}
      {tab==="calendar"&&(
        <div style={{padding:"20px 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <button onClick={()=>setViewMonth(p=>{const d=new Date(p.year,p.month-1);return{year:d.getFullYear(),month:d.getMonth()};})}
              style={{background:"#2a2a2a",border:"none",color:"#f0ece4",width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:16}}>‹</button>
            <span style={{fontSize:16,fontWeight:600}}>{year}년 {MONTHS_KO[month]}</span>
            <button onClick={()=>setViewMonth(p=>{const d=new Date(p.year,p.month+1);return{year:d.getFullYear(),month:d.getMonth()};})}
              style={{background:"#2a2a2a",border:"none",color:"#f0ece4",width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:16}}>›</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:8}}>
            {DAYS_KO.map(d=><div key={d} style={{textAlign:"center",fontSize:11,color:"#444",paddingBottom:8}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
            {calendarCells.map((d,i)=>{
              if(!d) return <div key={i}/>;
              const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
              const inRange=isInRange(d);
              const isToday=dateStr===todayStr;
              const isFuture=toMidnight(new Date(year,month,d))>today;
              const activeCats=categories.filter(c=>hasCatActivity(dateStr,c.id));
              const hasAny=activeCats.length>0;
              let bg;
              if(activeCats.length>=2){
                const n=activeCats.length;
                const stops=activeCats.map((c,ci)=>{
                  const start=Math.round(ci*100/n);
                  const end=Math.round((ci+1)*100/n);
                  return c.color+" "+start+"%, "+c.color+" "+end+"%";
                });
                bg="linear-gradient(135deg, "+stops.join(", ")+")";
              } else if(activeCats.length===1){
                bg=activeCats[0].color;
              } else {
                bg=isToday?"#2a2a2a":"transparent";
              }
              return(
                <div key={i} onClick={()=>{if(!inRange||isFuture)return;setCalSelected(calSelected===dateStr?null:dateStr);}} style={{
                  aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  borderRadius:10,fontSize:12,fontWeight:isToday?700:400,
                  cursor:inRange&&!isFuture?"pointer":"default",
                  background:bg,color:hasAny?"#141414":inRange?"#f0ece4":"#333",
                  border:calSelected===dateStr?"1px solid #fff":isToday&&!hasAny?"1px solid #C8A96E":"1px solid transparent",
                  transition:"all 0.15s",
                }}>
                  {d}
                </div>
              );
            })}
          </div>

          {calSelected&&(()=>{
            const dayKcal=getDayKcal(calSelected);
            return(
              <div style={{marginTop:16,padding:16,background:"#1e1e1e",borderRadius:14,border:"1px solid #2a2a2a"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#f0ece4"}}>{calSelected}</span>
                  <button onClick={()=>{setWorkoutDate(calSelected);setTab("workout");}}
                    style={{background:"#C8A96E",color:"#141414",border:"none",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                    상세 기록 →
                  </button>
                </div>
                {dayKcal>0&&(
                  <div style={{marginBottom:12,padding:"8px 12px",background:"#2a1e1a",borderRadius:8,fontSize:12,color:"#E85D3D",fontWeight:600,textAlign:"center"}}>
                    🔥 추정 소모 칼로리: {dayKcal} kcal
                  </div>
                )}
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {categories.map(cat=>{
                    const has=hasCatActivity(calSelected,cat.id);
                    const isEmpty=cat.items.length===0;
                    return(
                      <button key={cat.id} onClick={()=>{
                        if(isEmpty) return;
                        toggleCatForDate(calSelected,cat.id);
                      }} style={{
                        flex:"1 1 30%",minWidth:90,padding:"14px 6px",borderRadius:12,border:"none",cursor:isEmpty?"default":"pointer",
                        background:has?cat.color:"#2a2a2a",
                        textAlign:"center",fontSize:12,fontWeight:700,
                        color:has?"#141414":isEmpty?"#3a3a3a":"#555",
                        transition:"all 0.15s",
                        boxShadow:has?`0 0 12px ${cat.color}44`:"none",
                        opacity:isEmpty?0.5:1,
                      }}>
                        {cat.label}<br/>
                        <span style={{fontSize:11,fontWeight:500,marginTop:4,display:"block"}}>
                          {isEmpty?"⚠ 항목 없음":has?"✓ 진행중":"탭해서 기록"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div style={{marginTop:10,fontSize:10,color:"#444",textAlign:"center"}}>버튼 탭 → 운동탭으로 이동, 항목별로 직접 체크/기록</div>
                {categories.some(c=>c.items.length===0)&&(
                  <div style={{marginTop:6,fontSize:10,color:"#E85D3D",textAlign:"center"}}>⚠ "항목 없음" 카테고리는 운동 탭에서 항목을 먼저 추가해야 체크/색칠이 가능해요</div>
                )}
              </div>
            );
          })()}

          <div style={{marginTop:16,padding:14,background:"#1e1e1e",borderRadius:12,fontSize:11,color:"#555"}}>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {categories.map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:12,height:12,borderRadius:3,background:c.color}}/><span>{c.label}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:6,color:"#444"}}>날짜 탭 → 운동 체크 · 상세 기록으로 세부 조정</div>
          </div>
        </div>
      )}

      {/* ══ 운동 탭 ══ */}
      {tab==="workout"&&(
        <div>
          <div style={{background:"#1a1a1a",borderBottom:"1px solid #2a2a2a",padding:"12px 16px"}}>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
              {weekDates.map(ds=>{
                const isSel=ds===workoutDate;
                const isT=ds===todayStr;
                return(
                  <button key={ds} onClick={()=>setWorkoutDate(ds)} style={{
                    flex:"0 0 auto",background:isSel?"#C8A96E":isT?"#2a2a2a":"#1e1e1e",
                    border:isSel?"none":"1px solid #2a2a2a",borderRadius:10,padding:"8px 10px",cursor:"pointer",minWidth:60,textAlign:"center",
                  }}>
                    <div style={{fontSize:10,color:isSel?"#141414":"#666",marginBottom:2}}>{fmtShort(ds)}</div>
                    <div style={{fontSize:12,color:isSel?"#141414":getDayCheckedCount(ds)>0?"#C8A96E":"#444"}}>{getDayCheckedCount(ds)>0?"✓":"—"}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{padding:"16px 16px 0"}}>
            <div style={{background:"#1e1e1e",borderRadius:12,border:"1px solid #2a2a2a",padding:"14px 18px",marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                <div style={{fontSize:16,fontWeight:700}}>{fmtShort(workoutDate)}</div>
                {getDayKcal(workoutDate)>0&&(
                  <div style={{fontSize:13,color:"#E85D3D",fontWeight:700}}>🔥 {getDayKcal(workoutDate)} kcal</div>
                )}
              </div>
              <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                {categories.map(cat=>{
                  const done=cat.items.some(it=>dayLog.checks?.[`${cat.id}_${it.id}`]);
                  return <span key={cat.id} style={{fontSize:12,padding:"3px 10px",borderRadius:20,background:done?cat.color:"#2a2a2a",color:done?"#141414":"#555",fontWeight:done?700:400}}>{cat.label.split(" ")[0]} {done?"✓":"—"}</span>;
                })}
              </div>
            </div>

            {categories.map(cat=>{
              const catChecked=cat.items.filter(it=>dayLog.checks?.[`${cat.id}_${it.id}`]).length;
              const isOpen=expandedCat[cat.id];
              return(
                <div key={cat.id} style={{background:"#1e1e1e",borderRadius:12,border:"1px solid #2a2a2a",marginBottom:10,overflow:"hidden"}}>
                  <button onClick={()=>setExpandedCat(p=>({...p,[cat.id]:!p[cat.id]}))}
                    style={{width:"100%",background:"none",border:"none",cursor:"pointer",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:14,fontWeight:700,color:"#f0ece4"}}>{cat.label}</span>
                      <span style={{fontSize:11,background:"#2a2a2a",color:cat.color,borderRadius:20,padding:"2px 9px",fontWeight:600}}>{catChecked}/{cat.items.length}</span>
                    </div>
                    <span style={{fontSize:11,color:"#444",display:"inline-block",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
                  </button>
                  <div style={{height:3,background:"#2a2a2a"}}>
                    <div style={{height:3,width:`${cat.items.length?(catChecked/cat.items.length)*100:0}%`,background:cat.color,transition:"width .3s"}}/>
                  </div>
                  {isOpen&&(
                    <div style={{padding:"6px 0 10px"}}>
                      {cat.items.map(item=>{
                        const key=`${cat.id}_${item.id}`;
                        const checked=!!dayLog.checks?.[key];
                        const val=dayLog.values?.[key];
                        const displayVal=val||item.defaults;
                        const isExp=openItem===key;
                        return(
                          <div key={item.id} style={{borderLeft:checked?`3px solid ${cat.color}`:"3px solid transparent",background:checked?"rgba(255,255,255,0.03)":"transparent",transition:"background .15s"}}>
                            <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px"}}>
                              <button onClick={()=>toggleCheck(workoutDate,cat.id,item.id,item.defaults)}
                                style={{width:20,height:20,borderRadius:5,flexShrink:0,border:checked?"none":"2px solid #444",
                                  background:checked?cat.color:"transparent",cursor:"pointer",
                                  display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                                {checked&&<span style={{color:"#141414",fontSize:11,fontWeight:900,lineHeight:1}}>✓</span>}
                              </button>
                              <div onClick={()=>setOpenItem(isExp?null:key)} style={{flex:1,minWidth:0,cursor:"pointer"}}>
                                <div style={{fontSize:13,fontWeight:checked?600:400,color:checked?"#f0ece4":"#888"}}>{item.name}</div>
                                {displayVal&&<div style={{fontSize:11,color:cat.color,marginTop:1,fontWeight:600}}>{summaryText(item.type,displayVal)}{checked?` · 🔥${estimateKcal(item.type,displayVal)}kcal`:""}</div>}
                              </div>
                              <button onClick={()=>setOpenItem(isExp?null:key)}
                                style={{background:isExp?cat.color:"#2a2a2a",border:"none",borderRadius:6,width:26,height:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                <span style={{fontSize:13,color:isExp?"#141414":"#666",display:"inline-block",transform:isExp?"rotate(180deg)":"none"}}>⌄</span>
                              </button>
                            </div>
                            {isExp&&(
                              <div style={{padding:"4px 16px 14px 48px",background:"rgba(0,0,0,0.2)"}}>
                                <ItemControls type={item.type} val={displayVal} onChange={nv=>setVal(workoutDate,cat.id,item.id,nv)} color={cat.color}/>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {isOpen&&(
                    <div style={{padding:"0 12px 12px"}}>
                      {inlineEdit===cat.id?(
                        <div style={{background:"#141414",borderRadius:10,padding:"12px",border:"1px dashed #333"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <div style={{fontSize:11,color:"#555"}}>항목 관리</div>
                            <button onClick={()=>{
                              if(window.confirm(`"${cat.label}" 카테고리 전체를 삭제할까요?`)){
                                deleteCategory(cat.id);
                              }
                            }} style={{background:"#3a1a1a",border:"1px solid #5a2a2a",borderRadius:6,color:"#E85D3D",padding:"3px 9px",fontSize:10,cursor:"pointer"}}>
                              🗑 카테고리 삭제
                            </button>
                          </div>
                          <div style={{marginBottom:10}}>
                            {cat.items.map(item=>(
                              <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #222"}}>
                                <span style={{fontSize:12,color:"#888"}}>{item.name}</span>
                                <button onClick={()=>{
                                  const updated=categories.map(c=>c.id===cat.id?{...c,items:c.items.filter(it=>it.id!==item.id)}:c);
                                  saveCategories(updated);
                                }} style={{background:"#3a1a1a",border:"none",borderRadius:5,color:"#E85D3D",padding:"3px 8px",fontSize:11,cursor:"pointer"}}>삭제</button>
                              </div>
                            ))}
                          </div>
                          <input value={newItemName} onChange={e=>setNewItemName(e.target.value)}
                            placeholder="새 운동 이름..."
                            style={{width:"100%",background:"#2a2a2a",border:"1px solid #333",borderRadius:7,padding:"7px 10px",color:"#f0ece4",fontSize:12,boxSizing:"border-box",marginBottom:6}}/>
                          <select value={newItemType} onChange={e=>setNewItemType(e.target.value)}
                            style={{width:"100%",background:"#2a2a2a",border:"1px solid #333",borderRadius:7,padding:"7px 10px",color:"#f0ece4",fontSize:12,boxSizing:"border-box",marginBottom:8,cursor:"pointer"}}>
                            {TYPE_OPTIONS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>{
                              if(!newItemName.trim()) return;
                              const newItem={id:"item_"+Date.now(),name:newItemName.trim(),type:newItemType,defaults:defaultsForType(newItemType)};
                              const updated=categories.map(c=>c.id===cat.id?{...c,items:[...c.items,newItem]}:c);
                              saveCategories(updated);
                              setNewItemName(""); setNewItemType("minutes");
                            }} style={{flex:1,background:cat.color,color:"#141414",border:"none",borderRadius:7,padding:"8px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                              + 추가
                            </button>
                            <button onClick={()=>{setInlineEdit(null);setNewItemName("");setNewItemType("minutes");}}
                              style={{background:"#2a2a2a",color:"#888",border:"none",borderRadius:7,padding:"8px 12px",fontSize:12,cursor:"pointer"}}>
                              닫기
                            </button>
                          </div>
                        </div>
                      ):(
                        <button onClick={()=>setInlineEdit(cat.id)}
                          style={{width:"100%",background:"transparent",border:"1px dashed #333",borderRadius:8,padding:"8px",fontSize:11,color:"#555",cursor:"pointer"}}>
                          ＋ 항목 추가 / 삭제
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 새 카테고리 추가 */}
            {showCatForm?(
              <div style={{background:"#1e1e1e",borderRadius:12,border:"1px dashed #444",padding:14,marginBottom:14}}>
                <div style={{fontSize:12,color:"#888",marginBottom:10,fontWeight:600}}>📁 새 운동 카테고리 추가</div>
                <input value={newCatName} onChange={e=>setNewCatName(e.target.value)}
                  placeholder="카테고리 이름 (예: 요가, 복싱...)"
                  style={{width:"100%",background:"#2a2a2a",border:"1px solid #333",borderRadius:7,padding:"8px 10px",color:"#f0ece4",fontSize:12,boxSizing:"border-box",marginBottom:8}}/>
                <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                  {CAT_EMOJI_OPTIONS.map(e=>(
                    <button key={e} onClick={()=>setNewCatEmoji(e)} style={{
                      width:30,height:30,borderRadius:7,border:newCatEmoji===e?"2px solid #C8A96E":"1px solid #333",
                      background:"#2a2a2a",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,
                    }}>{e}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                  {CAT_COLOR_PALETTE.map(c=>(
                    <button key={c} onClick={()=>setNewCatColor(c)} style={{
                      width:26,height:26,borderRadius:"50%",border:newCatColor===c?"2px solid #fff":"none",
                      background:c,cursor:"pointer",padding:0,
                    }}/>
                  ))}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={addCategory} style={{flex:1,background:newCatColor,color:"#141414",border:"none",borderRadius:7,padding:"9px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    + 카테고리 만들기
                  </button>
                  <button onClick={()=>{setShowCatForm(false);setNewCatName("");}}
                    style={{background:"#2a2a2a",color:"#888",border:"none",borderRadius:7,padding:"9px 14px",fontSize:12,cursor:"pointer"}}>
                    취소
                  </button>
                </div>
              </div>
            ):(
              <button onClick={()=>setShowCatForm(true)}
                style={{width:"100%",background:"transparent",border:"1px dashed #444",borderRadius:10,padding:"12px",fontSize:12,color:"#666",cursor:"pointer",marginBottom:14}}>
                📁 ＋ 새 운동 카테고리 만들기 (헬스/필라테스 안 하는 경우)
              </button>
            )}

            <div style={{background:"#1e1e1e",borderRadius:12,border:"1px solid #2a2a2a",padding:"14px 16px",marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:600,color:"#666",marginBottom:8}}>📝 오늘의 메모 (컨디션·통증·느낀 점)</div>
              <textarea value={dayLog.memo||""} onChange={e=>saveMemo(workoutDate,e.target.value)}
                placeholder="오늘 운동 후 느낌을 기록하세요..." rows={3}
                style={{width:"100%",resize:"vertical",border:"none",outline:"none",fontSize:13,color:"#f0ece4",fontFamily:"inherit",lineHeight:1.6,background:"transparent",boxSizing:"border-box"}}/>
            </div>
          </div>
        </div>
      )}

      {/* ══ 인바디 탭 ══ */}
      {tab==="inbody"&&(
        <div style={{padding:"20px 16px"}}>

          <div style={{marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:12,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase"}}>내 목표 설정</div>
              <button onClick={()=>{
                setEditGoal({muscle:goals.muscle,fatMass:goals.fatMass,fatPct:goals.fatPct});
                setEditBase({date:baseInbody.date,weight:baseInbody.weight,muscle:baseInbody.muscle,fatMass:baseInbody.fatMass,fatPct:baseInbody.fatPct,score:baseInbody.score});
                setShowGoalForm(!showGoalForm);
              }} style={{background:showGoalForm?"#444":"#2a2a2a",color:"#C8A96E",border:"1px solid #C8A96E",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                ✏️ 수정
              </button>
            </div>

            {!showGoalForm?(
              <div style={{background:"#1e1e1e",borderRadius:12,padding:14}}>
                <div style={{fontSize:11,color:"#555",marginBottom:10}}>시작 수치 ({baseInbody.date})</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                  {[{l:"골격근량",v:baseInbody.muscle,u:"kg"},{l:"체지방량",v:baseInbody.fatMass,u:"kg"},{l:"체지방률",v:baseInbody.fatPct,u:"%"}].map((x,i)=>(
                    <div key={i} style={{textAlign:"center",background:"#2a2a2a",borderRadius:8,padding:"10px 4px"}}>
                      <div style={{fontSize:10,color:"#555",marginBottom:4}}>{x.l}</div>
                      <div style={{fontSize:15,fontWeight:700,color:"#f0ece4"}}>{x.v}<span style={{fontSize:10,color:"#555"}}>{x.u}</span></div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11,color:"#555",marginBottom:10}}>목표 수치 (8월 31일)</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {[{l:"골격근량",v:goals.muscle,u:"kg",up:true},{l:"체지방량",v:goals.fatMass,u:"kg",up:false},{l:"체지방률",v:goals.fatPct,u:"%",up:false}].map((x,i)=>(
                    <div key={i} style={{textAlign:"center",background:"#2a2a2a",borderRadius:8,padding:"10px 4px"}}>
                      <div style={{fontSize:10,color:"#555",marginBottom:4}}>{x.l}</div>
                      <div style={{fontSize:15,fontWeight:700,color:"#C8A96E"}}>{x.v}<span style={{fontSize:10,color:"#555"}}>{x.u}</span></div>
                      <div style={{fontSize:9,color:x.up?"#6ec87a":"#E85D3D"}}>{x.up?"▲ 증가":"▼ 감소"} 목표</div>
                    </div>
                  ))}
                </div>
              </div>
            ):(
              <div style={{background:"#1e1e1e",borderRadius:12,padding:14}}>
                <div style={{fontSize:11,color:"#555",marginBottom:10,fontWeight:600}}>📍 시작 수치 입력</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                  {[{key:"date",label:"측정일",type:"date"},{key:"weight",label:"체중(kg)",type:"number"},
                    {key:"muscle",label:"골격근량(kg)",type:"number"},{key:"fatMass",label:"체지방량(kg)",type:"number"},
                    {key:"fatPct",label:"체지방률(%)",type:"number"},{key:"score",label:"인바디점수",type:"number"}].map(f=>(
                    <div key={f.key}>
                      <div style={{fontSize:10,color:"#555",marginBottom:4}}>{f.label}</div>
                      <input type={f.type} value={editBase[f.key]} onChange={e=>setEditBase(p=>({...p,[f.key]:e.target.value}))}
                        style={{width:"100%",background:"#2a2a2a",border:"1px solid #333",borderRadius:8,padding:"7px 9px",color:"#f0ece4",fontSize:13,boxSizing:"border-box"}}/>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11,color:"#555",marginBottom:10,fontWeight:600}}>🎯 목표 수치 입력</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                  {[{key:"muscle",label:"골격근량(kg)",type:"number"},{key:"fatMass",label:"체지방량(kg)",type:"number"},{key:"fatPct",label:"체지방률(%)",type:"number"}].map(f=>(
                    <div key={f.key}>
                      <div style={{fontSize:10,color:"#555",marginBottom:4}}>{f.label}</div>
                      <input type={f.type} value={editGoal[f.key]} onChange={e=>setEditGoal(p=>({...p,[f.key]:e.target.value}))}
                        style={{width:"100%",background:"#2a2a2a",border:"1px solid #333",borderRadius:8,padding:"7px 9px",color:"#f0ece4",fontSize:13,boxSizing:"border-box"}}/>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{
                    const newGoals={muscle:parseFloat(editGoal.muscle)||goals.muscle,fatMass:parseFloat(editGoal.fatMass)||goals.fatMass,fatPct:parseFloat(editGoal.fatPct)||goals.fatPct};
                    const newBase={date:editBase.date||baseInbody.date,weight:parseFloat(editBase.weight)||baseInbody.weight,muscle:parseFloat(editBase.muscle)||baseInbody.muscle,fatMass:parseFloat(editBase.fatMass)||baseInbody.fatMass,fatPct:parseFloat(editBase.fatPct)||baseInbody.fatPct,score:parseInt(editBase.score)||baseInbody.score};
                    setGoals(newGoals);
                    setBaseInbody(newBase);
                    persistGoals(newGoals,newBase);
                    setInbodyLogs(prev=>{
                      const next=[newBase,...prev.filter((_,i)=>i>0)].sort((a,b)=>a.date.localeCompare(b.date));
                      persistInbody(next);
                      return next;
                    });
                    setShowGoalForm(false);
                  }} style={{flex:1,background:"#C8A96E",color:"#141414",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer"}}>저장</button>
                  <button onClick={()=>setShowGoalForm(false)} style={{background:"#2a2a2a",color:"#888",border:"none",borderRadius:8,padding:"10px 14px",fontSize:13,cursor:"pointer"}}>취소</button>
                </div>
              </div>
            )}
          </div>

          <div style={{marginBottom:20}}>
            <div style={{fontSize:12,color:"#C8A96E",letterSpacing:2,marginBottom:12,textTransform:"uppercase"}}>변동 그래프</div>
            {[
              {label:"골격근량",field:"muscle",unit:"kg",color:"#6ec87a",goal:goals.muscle},
              {label:"체지방량",field:"fatMass",unit:"kg",color:"#E85D3D",goal:goals.fatMass},
              {label:"체지방률",field:"fatPct",unit:"%",color:"#C8A96E",goal:goals.fatPct},
            ].map((c,i)=>(
              <div key={i} style={{marginBottom:14,padding:14,background:"#1e1e1e",borderRadius:12}}>
                <div style={{fontSize:12,color:"#888",marginBottom:6}}>{c.label}</div>
                <InbodyChart logs={inbodyLogs} field={c.field} unit={c.unit} color={c.color} goalValue={c.goal}/>
              </div>
            ))}
          </div>

          <div style={{marginBottom:20}}>
            <div style={{fontSize:12,color:"#C8A96E",letterSpacing:2,marginBottom:12,textTransform:"uppercase"}}>목표 달성률</div>
            {[
              {label:"골격근량",current:latest?.muscle,goal:goals.muscle,unit:"kg",progress:muscleProgress},
              {label:"체지방량",current:latest?.fatMass,goal:goals.fatMass,unit:"kg",progress:fatProgress},
              {label:"체지방률",current:latest?.fatPct,goal:goals.fatPct,unit:"%",progress:fatPctProgress},
            ].map((item,i)=>(
              <div key={i} style={{marginBottom:16,padding:16,background:"#1e1e1e",borderRadius:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:13,color:"#888"}}>{item.label}</span>
                  <span style={{fontSize:13}}>
                    <span style={{color:"#f0ece4",fontWeight:600}}>{item.current}{item.unit}</span>
                    <span style={{color:"#444"}}> → </span>
                    <span style={{color:"#C8A96E"}}>목표 {item.goal}{item.unit}</span>
                  </span>
                </div>
                <ProgressBar value={Math.max(0,item.progress)} color={item.progress>=100?"#6ec87a":"#C8A96E"}/>
                <div style={{fontSize:11,color:"#555",marginTop:6,textAlign:"right"}}>
                  {item.progress<=0?"아직 시작 전":item.progress>=100?"🎉 달성!":`${Math.round(item.progress)}% 달성`}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:12,color:"#C8A96E",letterSpacing:2,textTransform:"uppercase"}}>측정 기록</div>
              <button onClick={()=>setShowInbodyForm(!showInbodyForm)} style={{background:"#C8A96E",color:"#141414",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                + 기록 추가
              </button>
            </div>
            {showInbodyForm&&(
              <div style={{background:"#1e1e1e",borderRadius:12,padding:16,marginBottom:16}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  {[{key:"date",label:"측정일",type:"date"},{key:"weight",label:"체중(kg)",type:"number"},
                    {key:"muscle",label:"골격근량(kg)",type:"number"},{key:"fatMass",label:"체지방량(kg)",type:"number"},
                    {key:"fatPct",label:"체지방률(%)",type:"number"},{key:"score",label:"인바디 점수",type:"number"}].map(f=>(
                    <div key={f.key}>
                      <div style={{fontSize:10,color:"#555",marginBottom:4}}>{f.label}</div>
                      <input type={f.type} value={newInbody[f.key]} onChange={e=>setNewInbody(p=>({...p,[f.key]:e.target.value}))}
                        style={{width:"100%",background:"#2a2a2a",border:"1px solid #333",borderRadius:8,padding:"8px 10px",color:"#f0ece4",fontSize:13,boxSizing:"border-box"}}/>
                    </div>
                  ))}
                </div>
                <button onClick={addInbody} style={{width:"100%",background:"#C8A96E",color:"#141414",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer"}}>저장</button>
              </div>
            )}
            {[...inbodyLogs].reverse().map((log,i)=>(
              <div key={i} style={{background:"#1e1e1e",borderRadius:12,padding:14,marginBottom:8,borderLeft:i===0?"3px solid #C8A96E":"3px solid #2a2a2a"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                  <span style={{fontSize:12,color:i===0?"#C8A96E":"#555"}}>{log.date} {i===0?"· 최근":""}</span>
                  {log.score>0&&<span style={{fontSize:12,color:"#888"}}>점수 {log.score}점</span>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                  {[{label:"체중",value:log.weight,unit:"kg"},{label:"근육량",value:log.muscle,unit:"kg"},
                    {label:"체지방",value:log.fatMass,unit:"kg"},{label:"체지방률",value:log.fatPct,unit:"%"}].map((m,j)=>(
                    <div key={j} style={{textAlign:"center"}}>
                      <div style={{fontSize:10,color:"#444",marginBottom:2}}>{m.label}</div>
                      <div style={{fontSize:14,fontWeight:600}}>{m.value}<span style={{fontSize:10,color:"#555"}}>{m.unit}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{background:"#0a0a0a",borderTop:"1px solid #2a2a2a",padding:"20px 16px",textAlign:"center",marginTop:20}}>
        <div style={{fontSize:10,color:"#555",lineHeight:1.8}}>
          <div>Made with 💪 by 지큐 (문의: sjm2hjm2@gmail.com)</div>
          <div style={{marginTop:8}}>비상업적 개인용도만 허용</div>
          <div style={{marginTop:4,color:"#444"}}>© 2026 All rights reserved</div>
        </div>
      </div>
    </div>
  );
}
