
function cleanCustomPrograms(raw) {
 if(!Array.isArray(raw))return [];
 const seen=new Set();
 return raw.slice(0,60).map(p=>{
  if(!p||typeof p!=='object'||!/^custom_[a-zA-Z0-9_-]{5,90}$/.test(p.id||'')||seen.has(p.id))return null;
  const title=String(p.title||'').trim().slice(0,70);
  if(!title||!Array.isArray(p.exercises))return null;
  const exercises=p.exercises.slice(0,30).map(e=>{
    if(!Array.isArray(e))return null;
    const name=String(e[0]||'').trim().slice(0,80),sets=Number(e[1]),reps=Number(e[2]);
    return name&&Number.isInteger(sets)&&sets>=1&&sets<=20&&Number.isInteger(reps)&&reps>=1&&reps<=200?[name,sets,reps]:null;
  });
  if(!exercises.length||exercises.some(e=>!e))return null;
  seen.add(p.id);
  return {id:p.id,custom:true,title,tag:'МОЯ ПРОГРАММА',subtitle:String(p.subtitle||'').trim().slice(0,180),time:Math.min(180,Math.max(5,Number(p.time)||40)),icon:'dumbbell',exercises};
 }).filter(Boolean);
}
let programEditorDraft=null;
function openCustomEditor(id) {
 const saved=data.customPrograms.find(p=>p.id===id);
 programEditorDraft=saved?{id:saved.id,title:saved.title,subtitle:saved.subtitle,time:saved.time,exercises:saved.exercises.map(e=>({key:uid(),name:e[0],sets:e[1],reps:e[2]}))}:{id:null,title:'',subtitle:'',time:40,exercises:[{key:uid(),name:'',sets:3,reps:10}]};
 currentPage='programs';render();document.getElementById('customProgramName')?.focus();
}
function renderCustomProgramEditor() {
 const d=programEditorDraft;
 return `<section class="panel" style="padding:22px;margin-bottom:23px;border:1px solid #ef764e">
 <div class="section-head"><div><h2 class="section-title">${d.id?'Редактировать программу':'Создать программу'}</h2><div class="section-kicker">Упражнения, подходы, повторы и порядок</div></div><button class="btn btn-subtle btn-sm" data-action="custom-cancel">Закрыть</button></div>
 <div class="custom-editor-basic">
 <label>Название<input id="customProgramName" maxlength="70" placeholder="Моя тренировка спины" value="${escapeHTML(d.title)}" required></label>
 <label>Описание<input id="customProgramDescription" maxlength="180" placeholder="Что тренируем сегодня?" value="${escapeHTML(d.subtitle)}"></label>
 <label>Время (мин)<input id="customProgramTime" type="number" min="5" max="180" value="${d.time}"></label></div>
 <h3 style="font-size:17px;margin:22px 0 11px">Упражнения</h3>
 <div class="custom-editor-rows">${d.exercises.map((e,i)=>`<div class="custom-editor-row">
 <span class="custom-editor-n">${i+1}</span>
 <label style="flex:1;min-width:150px">Упражнение<input data-editor-field="name" data-index="${i}" value="${escapeHTML(e.name)}" maxlength="80" placeholder="Название упражнения"></label>
 <label>Подходы<input type="number" min="1" max="20" data-editor-field="sets" data-index="${i}" value="${e.sets}"></label>
 <label>Повторы<input type="number" min="1" max="200" data-editor-field="reps" data-index="${i}" value="${e.reps}"></label>
 <button class="btn btn-subtle btn-sm" data-action="custom-up" data-id="${i}" aria-label="Передвинуть вверх" ${i===0?'disabled':''}>↑</button>
 <button class="btn btn-subtle btn-sm" data-action="custom-down" data-id="${i}" aria-label="Передвинуть вниз" ${i===d.exercises.length-1?'disabled':''}>↓</button>
 <button class="btn btn-danger btn-sm" data-action="custom-remove-exercise" data-id="${i}" aria-label="Удалить упражнение">✕</button>
 </div>`).join('')}</div>
 <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px"><button class="btn btn-subtle" data-action="custom-add-exercise">${icon('plus',16)} Добавить упражнение</button><button class="btn btn-primary" data-action="custom-save">${icon('check',16)} Сохранить программу</button></div>
 <p class="panel-note" style="margin-top:12px">Свои программы сохраняются локально и входят в резервную копию JSON.</p></section>`;
}
function editorInputChanged(el) {
 const d=programEditorDraft;if(!d)return;
 if(el.id==='customProgramName')d.title=el.value;
 if(el.id==='customProgramDescription')d.subtitle=el.value;
 if(el.id==='customProgramTime')d.time=Number(el.value);
 if(el.dataset.editorField) {
  const item=d.exercises[Number(el.dataset.index)];
  if(item&&['name','sets','reps'].includes(el.dataset.editorField))item[el.dataset.editorField]=el.dataset.editorField==='name'?el.value:Number(el.value);
 }
}
function moveProgramExercise(index,offset) {
 if(!programEditorDraft)return;
 const rows=programEditorDraft.exercises,next=index+offset;
 if(index<0||next<0||index>=rows.length||next>=rows.length)return;
 [rows[index],rows[next]]=[rows[next],rows[index]];render();
}
function saveCustomProgram() {
 const d=programEditorDraft;if(!d)return;
 const title=String(d.title||'').trim();
 if(!title||title.length>70){toast('Напиши название программы (до 70 символов)');return;}
 if(!d.exercises.length||d.exercises.length>30){toast('Добавь от 1 до 30 упражнений');return;}
 const exercises=[];
 for(const e of d.exercises) {
  const name=String(e.name||'').trim(),sets=Number(e.sets),reps=Number(e.reps);
  if(!name||name.length>80||!Number.isInteger(sets)||sets<1||sets>20||!Number.isInteger(reps)||reps<1||reps>200){toast('Проверь упражнения, подходы (1–20) и повторы (1–200)');return;}
  exercises.push([name,sets,reps]);
 }
 if(!d.id&&data.customPrograms.length>=60){toast('Максимум 60 своих программ');return;}
 const p={id:d.id||'custom_'+uid().replace(/[^a-zA-Z0-9_-]/g,''),custom:true,title,tag:'МОЯ ПРОГРАММА',subtitle:String(d.subtitle||'').trim().slice(0,180),time:Math.min(180,Math.max(5,Number(d.time)||40)),icon:'dumbbell',exercises};
 const idx=data.customPrograms.findIndex(x=>x.id===p.id);
 if(idx>=0)data.customPrograms[idx]=p;else data.customPrograms.push(p);
 programEditorDraft=null;persist();render();toast('Программа сохранена!',true);
}
function deleteCustomProgram(id) {
 const p=data.customPrograms.find(x=>x.id===id);if(!p)return;
 const count=data.plans.filter(x=>x.programId===id).length;
 if(!confirm('Удалить программу «'+p.title+'»?'+(count?' Также будут удалены запланированные занятия: '+count+'.':'')))return;
 data.customPrograms=data.customPrograms.filter(x=>x.id!==id);data.plans=data.plans.filter(x=>x.programId!==id);
 if(data.defaultProgram===id)data.defaultProgram='full';
 if(programEditorDraft?.id===id)programEditorDraft=null;
 persist();render();toast('Программа удалена');
}
