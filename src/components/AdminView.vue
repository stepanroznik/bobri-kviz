<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { api } from '../api';
import { audioClipError } from '../audioClip';
import AudioClipEditor from './AudioClipEditor.vue';
import { createId, createQuestion, createRound, createTopic } from '../quiz';
import { moveQuestion, moveTopic } from '../quizEditing';
import type { Media, Quiz, Question, Round, Topic } from '../types';

const props = defineProps<{ quiz: Quiz; adminKey: string }>();
const emit = defineEmits<{ dirty: [value: boolean] }>();

const saving = ref(false);
const saved = ref(false);
const dirty = ref(false);
const expandedRounds = ref<Set<number>>(new Set());
const expandedQuestions = ref<Set<string>>(new Set());

type MoveRequest =
  | { kind: 'topic'; round: Round; topic: Topic }
  | { kind: 'question'; round: Round; topic: Topic; question: Question };

const moveDialog = ref<HTMLDialogElement | null>(null);
const moveRequest = shallowRef<MoveRequest | null>(null);
const destinationRoundIndex = ref('');
const destinationTopicIndex = ref('');
const moveError = ref('');
const moveNotice = ref('');
const destinationRounds = computed(() => props.quiz.rounds
  .map((round, index) => ({ round, index }))
  .filter(({ round }) => moveRequest.value?.kind !== 'topic' || round !== moveRequest.value.round));
const destinationRound = computed(() => destinationRoundIndex.value === ''
  ? undefined
  : props.quiz.rounds[Number(destinationRoundIndex.value)]);
const destinationTopics = computed(() => (destinationRound.value?.topics ?? [])
  .map((topic, index) => ({ topic, index }))
  .filter(({ topic }) => topic !== moveRequest.value?.topic));
const destinationTopic = computed(() => destinationTopicIndex.value === ''
  ? undefined
  : destinationRound.value?.topics[Number(destinationTopicIndex.value)]);
const canMove = computed(() => Boolean(moveRequest.value && destinationRound.value && (moveRequest.value.kind === 'topic'
  ? destinationRound.value !== moveRequest.value.round
  : destinationTopic.value && destinationTopic.value !== moveRequest.value?.topic)));

watch(destinationRoundIndex, () => {
  destinationTopicIndex.value = destinationTopics.value[0]?.index.toString() ?? '';
  moveError.value = '';
});

async function openMove(request: MoveRequest): Promise<void> {
  moveRequest.value = request;
  const firstRound = request.kind === 'topic'
    ? destinationRounds.value[0]
    : destinationRounds.value.find(({ round }) => round.topics.some((topic) => topic !== request.topic)) ?? destinationRounds.value[0];
  destinationRoundIndex.value = firstRound?.index.toString() ?? '';
  destinationTopicIndex.value = destinationTopics.value[0]?.index.toString() ?? '';
  moveError.value = '';
  await nextTick();
  moveDialog.value?.showModal();
}

function confirmMove(): void {
  const request = moveRequest.value;
  const targetRound = destinationRound.value;
  if (!request || !targetRound || !canMove.value) return;
  const targetTopic = destinationTopic.value;
  const moved = request.kind === 'topic'
    ? moveTopic(props.quiz, request.topic, targetRound)
    : Boolean(targetTopic && moveQuestion(props.quiz, request.question, targetTopic));
  if (!moved) {
    moveError.value = 'Přesun se nepodařil. Vyberte prosím znovu cíl.';
    return;
  }

  expandedRounds.value = new Set([...expandedRounds.value, Number(destinationRoundIndex.value)]);
  if (request.kind === 'question') expandedQuestions.value = new Set([...expandedQuestions.value, request.question.id]);
  markDirty();
  moveNotice.value = request.kind === 'topic'
    ? `Téma „${request.topic.title || 'Bez názvu'}“ přesunuto do kola „${targetRound.title}“. Změny potvrďte tlačítkem Uložit.`
    : `Otázka přesunuta do „${targetRound.title} / ${targetTopic?.title}“. Změny potvrďte tlačítkem Uložit.`;
  moveDialog.value?.close();
}

const totalQuestions = computed(() => props.quiz.rounds.reduce((sum, round) => sum + questionCount(round), 0));
const questionCount = (round: Round): number => round.topics.reduce((sum, topic) => sum + topic.questions.length, 0);
const maxQuestionCount = (round: Round): number => Math.max(0, ...round.topics.map((topic) => topic.questions.length));
const questionRows = (round: Round): Array<Array<Question | null>> =>
  Array.from({ length: maxQuestionCount(round) }, (_, index) => round.topics.map((topic) => topic.questions[index] ?? null));
const topicIsRecommended = (topic: Topic): boolean => topic.questions.length === 5;
const roundIsRecommended = (round: Round): boolean => round.topics.length === 2 && questionCount(round) === 10;
const mediaLabel = (media: Media): string => media.name || media.url || media.id || '';
const questionTypeLabel = (type: Question['type']): string => ({ text: 'Text', image: 'Obrázek', audio: 'Audio' })[type];
const roundTopicsLabel = (round: Round): string => round.topics.map((topic) => topic.title || 'Bez názvu').join(' · ') || 'Zatím bez témat';
const boardMinWidth = (round: Round): string => `${Math.max(1, round.topics.length) * 340 + Math.max(0, round.topics.length - 1) * 10}px`;

function markDirty(): void {
  moveNotice.value = '';
  saved.value = false;
  dirty.value = true;
  emit('dirty', true);
}

function isRoundOpen(index: number): boolean { return expandedRounds.value.has(index); }
function toggleRound(index: number): void {
  const next = new Set(expandedRounds.value);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  expandedRounds.value = next;
}
function expandAllRounds(): void { expandedRounds.value = new Set(props.quiz.rounds.map((_, index) => index)); }
function collapseAllRounds(): void { expandedRounds.value = new Set(); }

function isQuestionOpen(question: Question): boolean { return expandedQuestions.value.has(question.id); }
function toggleQuestion(question: Question): void {
  const next = new Set(expandedQuestions.value);
  if (next.has(question.id)) next.delete(question.id);
  else next.add(question.id);
  expandedQuestions.value = next;
}
function forgetQuestions(questions: Question[]): void {
  const next = new Set(expandedQuestions.value);
  questions.forEach((question) => next.delete(question.id));
  expandedQuestions.value = next;
}

function addRound(): void {
  const index = props.quiz.rounds.length;
  props.quiz.rounds.push(createRound(index + 1));
  expandedRounds.value = new Set([...expandedRounds.value, index]);
  markDirty();
}
function removeRound(index: number): void {
  const [removed] = props.quiz.rounds.splice(index, 1);
  if (!removed) return;
  forgetQuestions(removed.topics.flatMap((topic) => topic.questions));
  expandedRounds.value = new Set([...expandedRounds.value].filter((value) => value !== index).map((value) => value > index ? value - 1 : value));
  markDirty();
}
function addTopic(round: Round): void { round.topics.push(createTopic(round.topics.length + 1)); markDirty(); }
function removeTopic(round: Round, index: number): void {
  const [removed] = round.topics.splice(index, 1);
  if (!removed) return;
  forgetQuestions(removed.questions);
  markDirty();
}
function addQuestion(topic: Topic): void {
  const question = createQuestion();
  topic.questions.push(question);
  expandedQuestions.value = new Set([...expandedQuestions.value, question.id]);
  markDirty();
}
function removeQuestion(topic: Topic, index: number): void {
  const [removed] = topic.questions.splice(index, 1);
  if (!removed) return;
  forgetQuestions([removed]);
  markDirty();
}
function addSource(question: Question): void { question.sources.push({ label: '', url: '' }); markDirty(); }
function removeSource(question: Question, index: number): void { question.sources.splice(index, 1); markDirty(); }

const MAX_MEDIA_BYTES = 1_300_000;
const TARGET_IMAGE_BYTES = 1_200_000;
async function imageAsJpeg(file: File, maxSide: number, quality: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Prohlížeč nemůže připravit obrázek k nahrání.');
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Komprese obrázku se nepodařila.')), 'image/jpeg', quality));
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
async function optimizeImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= MAX_MEDIA_BYTES) return file;
  let maxSide = 1_920;
  let quality = 0.88;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const optimized = await imageAsJpeg(file, maxSide, quality);
    if (optimized.size <= TARGET_IMAGE_BYTES) return optimized;
    maxSide = Math.round(maxSide * 0.78);
    quality = Math.max(0.55, quality - 0.08);
  }
  throw new Error('Obrázek se ani po zmenšení nevejde pod 1,3 MB. Zkus prosím menší soubor.');
}
async function uploadMedia(file: File, question: Question): Promise<void> {
  const uploadFile = await optimizeImage(file);
  if (uploadFile.size > MAX_MEDIA_BYTES) throw new Error('Soubor je větší než 1,3 MB. Obrázky se zmenšují automaticky; audio je potřeba zkrátit nebo zkomprimovat před nahráním.');
  const id = createId();
  await api(`/api/admin/media?id=${encodeURIComponent(id)}&name=${encodeURIComponent(uploadFile.name)}`, { method: 'POST', headers: { 'X-Admin-Key': props.adminKey, 'Content-Type': uploadFile.type || 'application/octet-stream' }, body: uploadFile });
  question.media = { kind: 'stored', id, name: uploadFile.name, mime: uploadFile.type };
  delete question.audioStart;
  delete question.audioEnd;
  markDirty();
}
async function handleUpload(event: Event, question: Question): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try { await uploadMedia(file, question); }
  catch (error) { alert(error instanceof Error ? error.message : String(error)); }
}
function updateExternalMedia(event: Event, question: Question): void {
  const url = (event.target as HTMLInputElement).value.trim();
  if (url) question.media = { kind: 'external', url, name: url };
  else if (question.media?.kind === 'external') question.media = null;
  delete question.audioStart;
  delete question.audioEnd;
  markDirty();
}
async function removeMedia(question: Question): Promise<void> {
  const media = question.media;
  if (media?.kind === 'stored') {
    try { await api(`/api/admin/media?id=${encodeURIComponent(media.id ?? '')}`, { method: 'DELETE', headers: { 'X-Admin-Key': props.adminKey } }); }
    catch (error) {
      if (!confirm(`Médium se nepodařilo smazat na serveru (${error instanceof Error ? error.message : String(error)}). Odebrat ho aspoň z otázky?`)) return;
    }
  }
  question.media = null;
  delete question.audioStart;
  delete question.audioEnd;
  markDirty();
}
async function save(): Promise<void> {
  for (const round of props.quiz.rounds) for (const topic of round.topics) for (const question of topic.questions) {
    if (question.type === 'audio' && question.media && audioClipError(question)) {
      alert(`${round.title} / ${topic.title}: ${audioClipError(question)}`);
      return;
    }
  }
  saving.value = true;
  try {
    await api('/api/admin/quiz', { method: 'POST', headers: { 'X-Admin-Key': props.adminKey, 'Content-Type': 'application/json' }, body: JSON.stringify(props.quiz) });
    dirty.value = false;
    moveNotice.value = '';
    emit('dirty', false);
    saved.value = true;
    window.setTimeout(() => { saved.value = false; saving.value = false; }, 900);
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
    saving.value = false;
  }
}
</script>

<template>
  <div class="admin">
    <header class="admin-header">
      <div class="admin-brand"><img src="/logo.svg" alt="" /><span>Bobří kvíz · administrace</span></div>
      <div class="admin-actions">
        <span class="save-status" :class="{ 'save-status--dirty': dirty }">{{ dirty ? 'Neuložené změny' : 'Uloženo' }}</span>
        <a class="btn btn-secondary" href="/" target="_blank">Projektor ↗</a>
        <button class="btn btn-primary" type="button" :disabled="saving" @click="save">{{ saving ? 'Ukládám…' : saved ? 'Uloženo ✓' : 'Uložit' }}</button>
      </div>
    </header>

    <main class="admin-main">
      <section class="admin-overview">
        <div>
          <span class="admin-kicker">Obsah kvízu</span>
          <h1>{{ quiz.title || 'Bez názvu' }}</h1>
        </div>
        <div class="admin-summary"><strong>{{ quiz.rounds.length }}</strong> kol <span aria-hidden="true">·</span> <strong>{{ totalQuestions }}</strong> otázek</div>
      </section>

      <details class="admin-settings">
        <summary><span>Nastavení kvízu</span><small>Název a podtitulek</small></summary>
        <div class="admin-title-grid">
          <div class="field"><label for="quiz-title">Název</label><input id="quiz-title" v-model="quiz.title" @input="markDirty" /></div>
          <div class="field"><label for="quiz-subtitle">Podtitulek</label><input id="quiz-subtitle" v-model="quiz.subtitle" @input="markDirty" /></div>
        </div>
      </details>

      <div class="round-list-head">
        <h2>Kola</h2>
        <div class="round-list-actions">
          <button class="text-btn" type="button" @click="expandAllRounds">Rozbalit vše</button>
          <button class="text-btn" type="button" @click="collapseAllRounds">Sbalit vše</button>
        </div>
      </div>

      <p v-if="moveNotice" class="move-notice" role="status">{{ moveNotice }}</p>

      <section v-for="(round, roundIndex) in quiz.rounds" :key="roundIndex" class="round-card" :class="{ 'round-card--open': isRoundOpen(roundIndex) }">
        <header class="round-head">
          <button class="round-toggle" type="button" :aria-expanded="isRoundOpen(roundIndex)" :aria-controls="`round-panel-${roundIndex}`" @click="toggleRound(roundIndex)">
            <span class="round-chevron" aria-hidden="true">›</span>
            <span class="round-number">{{ roundIndex + 1 }}.</span>
            <span class="round-heading"><strong>{{ round.title || 'Kolo bez názvu' }}</strong><small>{{ roundTopicsLabel(round) }}</small></span>
          </button>
          <div class="round-meta">
            <span class="count-status" :class="{ 'count-status--ok': round.topics.length === 2 }">{{ round.topics.length }} / 2 témata</span>
            <span class="count-status" :class="{ 'count-status--ok': questionCount(round) === 10 }">{{ questionCount(round) }} / 10 otázek</span>
          </div>
        </header>

        <div v-if="isRoundOpen(roundIndex)" :id="`round-panel-${roundIndex}`" class="round-panel">
          <div class="round-toolbar">
            <div class="field"><label :for="`round-title-${roundIndex}`">Název kola</label><input :id="`round-title-${roundIndex}`" v-model="round.title" @input="markDirty" /></div>
            <button class="text-btn text-btn--danger" type="button" @click="removeRound(roundIndex)">Odebrat kolo</button>
          </div>
          <p v-if="!roundIsRecommended(round)" class="structure-warning">Doporučení: 2 témata po 5 otázkách. Odlišný počet lze bez omezení uložit.</p>

          <div class="round-board-scroll">
            <div class="round-board" :style="{ '--topic-count': Math.max(1, round.topics.length), minWidth: boardMinWidth(round) }">
              <section v-for="(topic, topicIndex) in round.topics" :key="`topic-${topicIndex}`" class="topic-column">
                <header class="topic-head">
                  <span class="topic-number">Téma {{ topicIndex + 1 }}</span>
                  <span class="count-status" :class="{ 'count-status--ok': topicIsRecommended(topic) }">{{ topic.questions.length }} / 5 otázek</span>
                </header>
                <div class="field"><label :for="`topic-title-${roundIndex}-${topicIndex}`">Název tématu</label><input :id="`topic-title-${roundIndex}-${topicIndex}`" v-model="topic.title" @input="markDirty" /></div>
                <div class="field"><label :for="`topic-subtitle-${roundIndex}-${topicIndex}`">Podtitulek</label><input :id="`topic-subtitle-${roundIndex}-${topicIndex}`" v-model="topic.subtitle" @input="markDirty" /></div>
                <div class="topic-actions">
                  <button class="text-btn" type="button" @click="openMove({ kind: 'topic', round, topic })">Přesunout téma…</button>
                  <button class="text-btn text-btn--danger" type="button" @click="removeTopic(round, topicIndex)">Odebrat téma</button>
                </div>
              </section>

              <div v-for="(row, rowIndex) in questionRows(round)" :key="`row-${rowIndex}`" class="question-row" :style="{ '--topic-count': Math.max(1, round.topics.length) }">
                <template v-for="(question, topicIndex) in row" :key="question?.id ?? `missing-${topicIndex}`">
                  <article v-if="question" class="question-card" :class="{ 'question-card--open': isQuestionOpen(question) }">
                    <button class="question-toggle" type="button" :aria-expanded="isQuestionOpen(question)" @click="toggleQuestion(question)">
                      <span class="question-number">{{ rowIndex + 1 }}</span>
                      <span class="question-preview"><strong>{{ question.prompt.trim() || 'Otázka bez zadání' }}</strong><small>{{ question.answer.trim() ? `Odpověď: ${question.answer}` : 'Odpověď není vyplněná' }}</small></span>
                      <span class="question-badges"><span v-if="question.media" class="question-badge">Médium</span><span class="question-badge">{{ questionTypeLabel(question.type) }}</span></span>
                      <span class="question-chevron" aria-hidden="true">›</span>
                    </button>

                    <div v-if="isQuestionOpen(question)" class="question-body">
                      <div class="question-edit-grid">
                        <div class="field field--wide"><label>Typ</label><select v-model="question.type" @change="markDirty"><option value="text">Text</option><option value="image">Obrázek</option><option value="audio">Audio</option></select></div>
                        <div class="field field--wide"><label>Otázka</label><textarea v-model="question.prompt" rows="2" @input="markDirty" /></div>
                        <div class="field field--wide"><label>Odpověď</label><textarea v-model="question.answer" rows="2" @input="markDirty" /></div>
                      </div>

                      <AudioClipEditor v-if="question.type === 'audio' && question.media" :question="question" @dirty="markDirty" />

                      <details class="question-more">
                        <summary>Další nastavení <span>{{ question.media ? 'Médium · ' : '' }}{{ question.sources.length }} zdrojů</span></summary>
                        <div class="question-more-body">
                          <div class="field"><label>Poznámka pro moderátora</label><textarea v-model="question.notes" rows="2" @input="markDirty" /></div>
                          <div class="field"><label>Nápověda k médiu / co pustit</label><textarea v-model="question.mediaHint" rows="2" @input="markDirty" /></div>
                          <div class="field"><label>Médium</label>
                            <div class="media-row">
                              <template v-if="question.media"><span class="media-pill">{{ question.media.kind === 'stored' ? 'Nahráno' : 'URL' }}: <span>{{ mediaLabel(question.media) }}</span></span><button class="btn btn-danger" type="button" @click="removeMedia(question)">Odebrat</button></template>
                              <input type="file" accept="image/*,audio/*" @change="handleUpload($event, question)" />
                              <input placeholder="nebo URL obrázku/audia" :value="question.media?.kind === 'external' ? question.media.url : ''" @change="updateExternalMedia($event, question)" />
                            </div>
                            <div class="tiny">Obrázky nad 1,3 MB se automaticky zmenší. Audio musí limit splnit při výběru.</div>
                          </div>
                          <div class="field"><label>Zdroje</label>
                            <div v-for="(source, sourceIndex) in question.sources" :key="sourceIndex" class="source-row"><input v-model="source.label" placeholder="Název zdroje" @input="markDirty" /><input v-model="source.url" placeholder="https://…" @input="markDirty" /><button type="button" title="Odebrat zdroj" @click="removeSource(question, sourceIndex)">×</button></div>
                            <button class="add-source" type="button" @click="addSource(question)">+ Přidat zdroj</button>
                          </div>
                        </div>
                      </details>
                      <div class="question-footer">
                        <button class="text-btn" type="button" @click="openMove({ kind: 'question', round, topic: round.topics[topicIndex], question })">Přesunout otázku…</button>
                        <button class="text-btn text-btn--danger" type="button" @click="removeQuestion(round.topics[topicIndex], rowIndex)">Odebrat otázku</button>
                      </div>
                    </div>
                  </article>
                  <button v-else class="question-card question-card--empty" type="button" @click="addQuestion(round.topics[topicIndex])">+ Přidat otázku {{ rowIndex + 1 }}</button>
                </template>
              </div>

              <button v-for="(topic, topicIndex) in round.topics" :key="`add-${topicIndex}`" class="add-content-btn" type="button" @click="addQuestion(topic)">+ Přidat otázku do tématu {{ topicIndex + 1 }}</button>
            </div>
          </div>
          <button class="add-content-btn add-content-btn--round" type="button" @click="addTopic(round)">+ Přidat téma</button>
        </div>
      </section>

      <button class="add-round-btn" type="button" @click="addRound">+ Přidat kolo</button>
    </main>

    <dialog ref="moveDialog" class="move-dialog" aria-labelledby="move-title" @close="moveRequest = null">
      <form v-if="moveRequest" @submit.prevent="confirmMove">
        <header class="move-dialog__header">
          <h2 id="move-title">{{ moveRequest.kind === 'topic' ? 'Přesunout téma' : 'Přesunout otázku' }}</h2>
          <button class="text-btn move-dialog__close" type="button" aria-label="Zavřít" @click="moveDialog?.close()">×</button>
        </header>
        <p class="move-dialog__preview">{{ moveRequest.kind === 'topic' ? moveRequest.topic.title : moveRequest.question.prompt || 'Otázka bez zadání' }}</p>
        <p class="tiny">Z: {{ moveRequest.round.title }} / {{ moveRequest.topic.title }}</p>
        <div class="field">
          <label for="move-round">Cílové kolo</label>
          <select id="move-round" v-model="destinationRoundIndex" autofocus>
            <option v-if="!destinationRounds.length" value="">Nejprve přidejte další kolo</option>
            <option v-for="{ round, index } in destinationRounds" :key="index" :value="String(index)">{{ index + 1 }}. {{ round.title || 'Kolo bez názvu' }}</option>
          </select>
        </div>
        <div v-if="moveRequest.kind === 'question'" class="field">
          <label for="move-topic">Cílové téma</label>
          <select id="move-topic" v-model="destinationTopicIndex" :disabled="!destinationTopics.length">
            <option v-if="!destinationTopics.length" value="">V tomto kole není jiné téma</option>
            <option v-for="{ topic, index } in destinationTopics" :key="index" :value="String(index)">{{ index + 1 }}. {{ topic.title || 'Téma bez názvu' }}</option>
          </select>
        </div>
        <p class="tiny">{{ moveRequest.kind === 'topic' ? 'Celé téma včetně otázek se zařadí na konec cílového kola.' : 'Otázka včetně médií a zdrojů se zařadí na konec cílového tématu.' }}</p>
        <p v-if="moveError" class="admin-error" role="alert">{{ moveError }}</p>
        <footer class="move-dialog__actions">
          <button class="btn btn-secondary" type="button" @click="moveDialog?.close()">Zrušit</button>
          <button class="btn btn-primary" type="submit" :disabled="!canMove">Přesunout</button>
        </footer>
      </form>
    </dialog>
  </div>
</template>
