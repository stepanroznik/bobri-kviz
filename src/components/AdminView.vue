<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../api';
import { createId } from '../quiz';
import type { Media, Quiz, Question, Source } from '../types';

const props = defineProps<{ quiz: Quiz; adminKey: string }>();
const emit = defineEmits<{ dirty: [value: boolean] }>();

const saving = ref(false);
const saved = ref(false);
const dirty = ref(false);

function markDirty(): void {
  saved.value = false;
  dirty.value = true;
  emit('dirty', true);
}

async function uploadMedia(file: File, question: Question): Promise<void> {
  if (file.size > 1_300_000) {
    throw new Error('Soubor je větší než 1,3 MB. Obrázek zmenši nebo audio zkrať / zkomprimuj.');
  }
  const id = createId();
  await api(`/api/admin/media?id=${encodeURIComponent(id)}&name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: {
      'X-Admin-Key': props.adminKey,
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  question.media = { kind: 'stored', id, name: file.name, mime: file.type };
  markDirty();
}

async function handleUpload(event: Event, question: Question): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    await uploadMedia(file, question);
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
  }
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
    try {
      await api(`/api/admin/media?id=${encodeURIComponent(media.id ?? '')}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': props.adminKey },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!confirm(`Médium se nepodařilo smazat na serveru (${message}). Odebrat ho aspoň z otázky?`)) return;
    }
  }
  question.media = null;
  markDirty();
}

function addSource(question: Question): void {
  question.sources.push({ label: '', url: '' });
  markDirty();
}

function removeSource(question: Question, sourceIndex: number): void {
  question.sources.splice(sourceIndex, 1);
  markDirty();
}

function mediaLabel(media: Media): string {
  return media.name || media.url || media.id || '';
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    await api('/api/admin/quiz', {
      method: 'POST',
      headers: { 'X-Admin-Key': props.adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(props.quiz),
    });
    emit('dirty', false);
    dirty.value = false;
    saved.value = true;
    window.setTimeout(() => {
      saved.value = false;
      saving.value = false;
    }, 900);
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
    saving.value = false;
  }
}
</script>

<template>
  <div class="admin">
    <header class="admin-header">
      <div class="admin-brand"><img src="/logo.svg" alt="" /><div>Bobří kvíz · administrace</div></div>
      <div class="admin-actions">
        <span class="save-status">{{ dirty ? 'Neuložené změny' : 'Uloženo' }}</span>
        <a class="btn btn-secondary" href="/" target="_blank">Projektor ↗</a>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Ukládám…' : saved ? 'Uloženo ✓' : 'Uložit' }}</button>
      </div>
    </header>

    <main class="admin-main">
      <div class="admin-note"><strong>Struktura je pevná:</strong> 5 kol × 2 témata × 5 otázek. Na konci každého kola projektor automaticky vloží 60s odpočet. Téma nebo jednotlivou otázku lze vypnout.</div>
      <div class="admin-title-grid">
        <div class="field"><label>Název</label><input v-model="quiz.title" @input="markDirty" /></div>
        <div class="field"><label>Podtitulek</label><input v-model="quiz.subtitle" @input="markDirty" /></div>
      </div>

      <section v-for="(round, roundIndex) in quiz.rounds" :key="roundIndex" class="round-card">
        <div class="round-head"><h2 class="round-title">{{ round.title }}</h2><span class="tiny">Kolo {{ roundIndex + 1 }}</span></div>
        <div class="topics-grid">
          <section v-for="(topic, topicIndex) in round.topics" :key="topicIndex" class="topic-card">
            <div class="topic-admin-head">
              <label class="toggle"><input v-model="topic.enabled" type="checkbox" @change="markDirty" /> zapnout téma</label>
              <strong>Téma {{ topicIndex + 1 }}</strong>
            </div>
            <div class="field"><label>Název tématu</label><input v-model="topic.title" @input="markDirty" /></div>
            <div class="field"><label>Podtitulek</label><input v-model="topic.subtitle" @input="markDirty" /></div>

            <article v-for="(question, questionIndex) in topic.questions" :key="question.id" class="question-card">
              <h4>Otázka {{ questionIndex + 1 }}</h4>
              <div class="q-grid">
                <div class="field"><label>Zapnuto</label><select v-model="question.enabled" @change="markDirty"><option :value="true">Ano</option><option :value="false">Ne</option></select></div>
                <div class="field"><label>Typ</label><select v-model="question.type" @change="markDirty"><option value="text">Text</option><option value="image">Obrázek</option><option value="audio">Audio</option></select></div>
                <div class="field span-2"><label>Otázka</label><textarea v-model="question.prompt" @input="markDirty" /></div>
                <div class="field span-2"><label>Odpověď</label><input v-model="question.answer" @input="markDirty" /></div>
                <div class="field span-2"><label>Poznámka pro moderátora</label><textarea v-model="question.notes" @input="markDirty" /></div>
                <div class="field span-2"><label>Nápověda k médiu / co pustit</label><input v-model="question.mediaHint" @input="markDirty" /></div>
                <div class="field span-2">
                  <label>Médium</label>
                  <div class="media-row">
                    <template v-if="question.media">
                      <span class="media-pill">{{ question.media.kind === 'stored' ? 'Nahráno' : 'URL' }}: <span>{{ mediaLabel(question.media) }}</span></span>
                      <button class="btn btn-danger" @click="removeMedia(question)">Odebrat</button>
                    </template>
                    <input type="file" accept="image/*,audio/*" @change="handleUpload($event, question)" />
                    <input placeholder="nebo URL obrázku/audia" :value="question.media?.kind === 'external' ? question.media.url : ''" @change="updateExternalMedia($event, question)" />
                  </div>
                  <div class="tiny">Upload do D1 je omezen na 1,3 MB na soubor. Pro audio stačí krátká MP3 ukázka.</div>
                </div>
                <div class="field span-2">
                  <label>Zdroje</label>
                  <div v-for="(source, sourceIndex) in question.sources" :key="sourceIndex" class="source-row">
                    <input v-model="source.label" @input="markDirty" />
                    <input v-model="source.url" @input="markDirty" />
                    <button @click="removeSource(question, sourceIndex)">×</button>
                  </div>
                  <button class="add-source" @click="addSource(question)">+ zdroj</button>
                </div>
              </div>
            </article>
          </section>
        </div>
      </section>
    </main>
  </div>
</template>
