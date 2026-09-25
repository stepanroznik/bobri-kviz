import { readQuiz, json } from '../_lib.js';
export async function onRequestGet({env}){try{const {quiz,updatedAt}=await readQuiz(env);return json({...quiz,_updatedAt:updatedAt})}catch(e){return json({error:e.message||'Database error'},500)}}
