<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '../api';
import { createId, createQuestion, createRound, createTopic } from '../quiz';
import type { Media, Quiz, Question, Round, Topic } from '../types';

const props = defineProps<{ quiz: Quiz; adminKey: string }>();
const emit = defineEmits<{ dirty: [value: boolean] }>();
const saving = ref(false);
const saved = ref(false);
const dirty = ref(false);
const totalQuestions = computed(() => props.quiz.rounds.reduce((sum, round) => sum + questionCount(round), 0));

function markDirty(): void { saved.value = false; dirty.value = true; emit('dirty', true); }
function questionCount(round: Round): number { return round.topics.reduce((sum, topic) => sum + topic.questions.length, 0); }
function topicIsRecommended(topic: Topic): boolean { return topic.questions.length === 5; }
function roundIsRecommended(round: Round): boolean { return round.topics.length === 2 && questionCount(round) === 10; }
function mediaLabel(media: Media): string { return media.name || media.url || media.id || ''; }
function addRound(): void { props.quiz.rounds.push(createRound(props.quiz.rounds.length + 1)); markDirty(); }
function removeRound(index: number): void { props.quiz.rounds.splice(index, 1); markDirty(); }
function addTopic(round: Round): void { round.topics.push(createTopic(round.topics.length + 1)); markDirty(); }
function removeTopic(round: Round, index: number): void { round.topics.splice(index, 1); markDirty(); }
function addQuestion(topic: Topic): void { topic.questions.push(createQuestion()); markDirty(); }
function removeQuestion(topic: Topic, index: number): void { topic.questions.splice(index, 1); markDirty(); }
function addSource(question: Question): void { question.sources.push({ label: '', url: '' }); markDirty(); }
function removeSource(question: Question, index: number): void { question.sources.splice(index, 1); markDirty(); }

async function uploadMedia(file: File, question: Question): Promise<void> {
  if (file.size > 1_300_000) throw new Error('Soubor je větší než 1,3 MB. Obrázek zmenši nebo audio zkrať / zkomprimuj.');
  const id = createId();
  await api(`/api/admin/media?id=${encodeURIComponent(id)}&name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'X-Admin-Key': props.adminKey, 'Content-Type': file.type || 'application/octet-stream' }, body: file });
  question.media = { kind: 'stored', id, name: file.name, mime: file.type };
  markDirty();
}
async function handleUpload(event: Event, question: Question): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try { await uploadMedia(file, question); } catch (error) { alert(error instanceof Error ? error.message : String(error)); }
}
function updateExternalMedia(event: Event, question: Question): void {
  const url = (event.target as HTMLInputElement).value.trim();
  if (url) question.media = { kind: 'external', url, name: url };
  else if (question.media?.kind === 'external') question.media = null;
  markDirty();
}
async function removeMedia(question: Question): Promise<void> {
  const media = question.media;
  if (media?.kind === 'stored') {
    try { await api(`/api/admin/media?id=${encodeURIComponent(media.id ?? '')}`, { method: 'DELETE', headers: { 'X-Admin-Key': props.adminKey } }); }
    catch (error) { if (!confirm(`Médium se nepodařilo smazat na serveru (${error instanceof Error ? error.message : String(error)}). Odebrat ho aspoň z otázky?`)) return; }
  }
  question.media = null;
  markDirty();
}
async function save(): Promise<void> {
  saving.value = true;
  try {
    await api('/api/admin/quiz', { method: 'POST', headers: { 'X-Admin-Key': props.adminKey, 'Content-Type': 'application/json' }, body: JSON.stringify(props.quiz) });
    dirty.value = false; emit('dirty', false); saved.value = true;
    window.setTimeout(() => { saved.value = false; saving.value = false; }, 900);
  } catch (error) { alert(error instanceof Error ? error.message : String(error)); saving.value = false; }
}
</script>

<template>
  <div class="admin">
    <header class="admin-header"><div class="admin-brand"><img src="/logo.svg" alt="" /><div>Bobří kvíz · administrace</div></div><div class="admin-actions"><span class="save-status">{{ dirty ? 'Neuložené změny' : 'Uloženo' }}</span><a class="btn btn-secondary" href="/" target="_blank">Projektor ↗</a><button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Ukládám…' : saved ? 'Uloženo ✓' : 'Uložit' }}</button></div></header>
    <main class="admin-main">
      <section class="admin-intro"><div><span class="admin-kicker">Obsah kvízu</span><h1>{{ quiz.title || 'Bez názvu' }}</h1><p>Počty jsou jen doporučení — kvíz lze uložit v libovolné struktuře.</p></div><div class="admin-summary"><strong>{{ quiz.rounds.length }}</strong><span>kol</span><strong>{{ totalQuestions }}</strong><span>otázek</span></div></section>
      <div class="admin-title-grid"><div class="field"><label>Název</label><input v-model="quiz.title" @input="markDirty" /></div><div class="field"><label>Podtitulek</label><input v-model="quiz.subtitle" @input="markDirty" /></div></div>
      <section v-for="(round, roundIndex) in quiz.rounds" :key="roundIndex" class="round-card">
        <header class="round-head"><div class="round-heading"><span class="round-number">Kolo {{ roundIndex + 1 }}</span><input v-model="round.title" class="round-title-input" aria-label="Název kola" @input="markDirty" /></div><div class="round-meta"><span class="count-status" :class="{ 'count-status--ok': round.topics.length === 2 }">{{ round.topics.length }} / 2 témata</span><span class="count-status" :class="{ 'count-status--ok': questionCount(round) === 10 }">{{ questionCount(round) }} / 10 otázek</span><button class="icon-btn" title="Odebrat kolo" @click="removeRound(roundIndex)">×</button></div></header>
        <div v-if="!roundIsRecommended(round)" class="structure-warning">Doporučené rozložení kola: 2 témata a celkem 10 otázek. Uložit lze i jiný počet.</div>
        <div class="topics-grid">
          <section v-for="(topic, topicIndex) in round.topics" :key="topicIndex" class="topic-card">
            <header class="topic-head"><div><span class="topic-number">Téma {{ topicIndex + 1 }}</span><span class="count-status" :class="{ 'count-status--ok': topicIsRecommended(topic) }">{{ topic.questions.length }} / 5 otázek</span></div><div><label class="toggle"><input v-model="topic.enabled" type="checkbox" @change="markDirty" /> zapnuto</label><button class="icon-btn" title="Odebrat téma" @click="removeTopic(round, topicIndex)">×</button></div></header>
            <div class="topic-title-fields"><div class="field"><label>Název tématu</label><input v-model="topic.title" @input="markDirty" /></div><div class="field"><label>Podtitulek</label><input v-model="topic.subtitle" @input="markDirty" /></div></div>
            <div class="questions-grid">
              <article v-for="(question, questionIndex) in topic.questions" :key="question.id" class="question-card">
                <header class="question-head"><strong>Otázka {{ questionIndex + 1 }}</strong><button class="text-btn text-btn--danger" @click="removeQuestion(topic, questionIndex)">Odebrat</button></header>
                <div class="question-edit-grid"><div class="field"><label>Zapnuto</label><select v-model="question.enabled" @change="markDirty"><option :value="true">Ano</option><option :value="false">Ne</option></select></div><div class="field"><label>Typ</label><select v-model="question.type" @change="markDirty"><option value="text">Text</option><option value="image">Obrázek</option><option value="audio">Audio</option></select></div><div class="field field--wide"><label>Otázka</label><textarea v-model="question.prompt" @input="markDirty" /></div><div class="field field--wide"><label>Odpověď</label><input v-model="question.answer" @input="markDirty" /></div><div class="field"><label>Poznámka pro moderátora</label><textarea v-model="question.notes" @input="markDirty" /></div><div class="field"><label>Nápověda k médiu / co pustit</label><textarea v-model="question.mediaHint" @input="markDirty" /></div><div class="field field--wide"><label>Médium</label><div class="media-row"><template v-if="question.media"><span class="media-pill">{{ question.media.kind === 'stored' ? 'Nahráno' : 'URL' }}: <span>{{ mediaLabel(question.media) }}</span></span><button class="btn btn-danger" @click="removeMedia(question)">Odebrat</button></template><input type="file" accept="image/*,audio/*" @change="handleUpload($event, question)" /><input placeholder="nebo URL obrázku/audia" :value="question.media?.kind === 'external' ? question.media.url : ''" @change="updateExternalMedia($event, question)" /></div><div class="tiny">Upload do D1 je omezen na 1,3 MB na soubor.</div></div><div class="field field--wide"><label>Zdroje</label><div v-for="(source, sourceIndex) in question.sources" :key="sourceIndex" class="source-row"><input v-model="source.label" placeholder="Název zdroje" @input="markDirty" /><input v-model="source.url" placeholder="https://…" @input="markDirty" /><button @click="removeSource(question, sourceIndex)">×</button></div><button class="add-source" @click="addSource(question)">+ zdroj</button></div></div>
              </article>
            </div>
            <button class="add-content-btn" @click="addQuestion(topic)">+ Přidat otázku</button>
          </section>
        </div>
        <button class="add-content-btn add-content-btn--round" @click="addTopic(round)">+ Přidat téma</button>
      </section>
      <button class="add-round-btn" @click="addRound">+ Přidat kolo</button>
    </main>
  </div>
</template>
