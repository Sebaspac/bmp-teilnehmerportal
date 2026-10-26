'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Eye, Info, PencilLine, Plus, Trash2 } from 'lucide-react'

import { FootLabel, SelectField, TextAreaField, TextField, cx } from '@/portal/ui/fields'
import { StatusBadge } from '@/portal/ui/PhaseTimeline'
import { FIELD_TYPES, FIELD_TYPE_LABEL, PRIZES, allFields, definitionOf, definitionProblem, prizeById, requiredFields } from '@/portal/domain/questionnaire'
import { portalContent } from '@/portal/content/portalContent'
import { newClientId, runCommand, sendCommand } from '@/portal/data/portalClient'
import { submittedSubmissions } from '@/portal/domain/selectors'
import type { FieldType, PortalSnapshot, PrizeId, QuestionField, QuestionSection, QuestionnaireDefinition } from '@/portal/domain/types'
import { Page, type PageHandle } from '@/portal/ui/Page'
import { SectionForm } from '@/portal/ui/QuestionnaireSheet'
import { formatDate } from '@/portal/ui/SubmissionSheet'
import styles from '@/portal/ui/portal.module.css'

type Navigate = (path: string) => void

/** Wie oft ein Preis gewählt, sein Fragebogen begonnen und eingereicht wurde. */
function usageOf(state: PortalSnapshot, prize: PrizeId) {
  const all = submittedSubmissions(state)
  return {
    chosen: all.filter((submission) => submission.process.prizes.includes(prize)).length,
    started: all.filter((submission) => submission.process.questionnaires[prize]).length,
    submitted: all.filter((submission) => submission.process.questionnaires[prize]?.status === 'eingereicht').length,
  }
}

/* ── Übersicht: die drei Fragebögen ──────────────────────────────────────── */

/** Bereich „Fragebögen“: je Preis Status, Umfang, Nutzung und die Aktionen Bearbeiten, Freischalten, Zurückziehen. */
export function DefinitionsSection({ state, navigate }: { state: PortalSnapshot; navigate: Navigate }) {
  const copy = portalContent.admin.definitions
  return (
    <section aria-label={portalContent.admin.tabs.find((tab) => tab.key === 'frageboegen')!.title}>
      <ul className={styles.exportList}>
        {PRIZES.map((prize) => {
          const definition = definitionOf(state, prize.id)
          if (!definition) return null
          const usage = usageOf(state, prize.id)
          const released = definition.status === 'freigeschaltet'
          const problem = definitionProblem(definition.sections)
          return (
            <li key={prize.id} className={cx(styles.exportRow, styles.definitionRow)}>
              <span className={styles.exportText}>
                <span className={styles.definitionTitle}>
                  <span className={styles.exportTitle}>{prize.title}</span>
                  <StatusBadge label={copy.status[definition.status]} tone={released ? 'freigeschaltet' : 'wartend'} />
                </span>
                <span className={styles.hint}>
                  {copy.counts(definition.sections.length, allFields(definition.sections).length, requiredFields(definition.sections).length)}
                  {' · '}
                  {released && definition.releasedAt ? copy.releasedAt(formatDate(definition.releasedAt)) : copy.updatedAt(formatDate(definition.updatedAt))}
                </span>
                <span className={styles.hint}>{copy.usage(usage.chosen, usage.started, usage.submitted)}</span>
                {released && usage.started > 0 && <span className={styles.hint}>{copy.withdrawBlocked}</span>}
              </span>
              <span className={styles.definitionActions}>
                <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={() => navigate(`/portal/admin/frageboegen/${prize.id}`)}>
                  {released ? <Eye size={15} aria-hidden="true" /> : <PencilLine size={15} aria-hidden="true" />}
                  {released ? copy.view : copy.edit}
                  <span className={styles.srOnly}>: {prize.title}</span>
                </button>
                {released ? (
                  <button
                    type="button"
                    className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)}
                    disabled={usage.started > 0}
                    onClick={() => window.confirm(copy.withdrawConfirm(prize.title)) && void runCommand({ type: 'questionnaireDef.withdraw', prize: prize.id })}
                  >
                    {copy.withdraw}
                    <span className={styles.srOnly}>: {prize.title}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={cx(styles.btn, styles.btnPrimary, styles.btnSmall)}
                    disabled={Boolean(problem)}
                    title={problem ?? undefined}
                    onClick={() => window.confirm(copy.releaseConfirm(prize.title)) && void runCommand({ type: 'questionnaireDef.release', prize: prize.id })}
                  >
                    <Check size={15} aria-hidden="true" />
                    {copy.release}
                    <span className={styles.srOnly}>: {prize.title}</span>
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ── Editor ──────────────────────────────────────────────────────────────── */

const newField = (): QuestionField => ({ id: `f_${newClientId().slice(0, 8)}`, label: portalContent.admin.editor.newField, type: 'text', span: 'full' })
const newSection = (): QuestionSection => ({
  id: `s_${newClientId().slice(0, 8)}`,
  step: portalContent.admin.editor.newSection,
  heading: portalContent.admin.editor.newSection,
  fields: [newField()],
})

const move = <T,>(list: T[], index: number, delta: number) => {
  const target = index + delta
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** Auswahlmöglichkeiten als Text (eine je Zeile) und zurück; neue Möglichkeiten nehmen ihren Text als Wert. */
const optionsText = (field: QuestionField) => (field.options ?? []).map((option) => option.label).join('\n')
const parseOptions = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label) => ({ value: label, label }))

/**
 * Fragebogen eines Preises bearbeiten. Im Entwurf frei (Abschnitte und Fragen hinzufügen, umstellen, entfernen,
 * Antwortformat ändern); freigeschaltet nur Texte – die Regel prüft auch der Befehl `questionnaireDef.update`.
 * Änderungen sammeln sich lokal und werden mit „Änderungen speichern“ übernommen.
 */
export function DefinitionEditor({ definition, onClose }: { definition: QuestionnaireDefinition; onClose: () => void }) {
  const copy = portalContent.admin.editor
  const listCopy = portalContent.admin.definitions
  const sheetRef = useRef<PageHandle>(null)
  const prize = prizeById(definition.prize)
  const released = definition.status === 'freigeschaltet'
  const [sections, setSections] = useState<QuestionSection[]>(definition.sections)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const dirty = useMemo(() => JSON.stringify(sections) !== JSON.stringify(definition.sections), [sections, definition.sections])
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({})

  // Wird der Fragebogen woanders geändert (anderer Tab), übernimmt der Editor den Stand, solange hier nichts offen ist.
  useEffect(() => {
    if (!dirty) setSections(definition.sections)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.sections])

  const updateSection = (index: number, patch: Partial<QuestionSection>) => setSections((list) => list.map((item, position) => (position === index ? { ...item, ...patch } : item)))
  const updateField = (sectionIndex: number, fieldIndex: number, patch: Partial<QuestionField>) =>
    setSections((list) =>
      list.map((item, position) => (position === sectionIndex ? { ...item, fields: item.fields.map((field, current) => (current === fieldIndex ? { ...field, ...patch } : field)) } : item)),
    )

  const save = async () => {
    const response = await sendCommand({ type: 'questionnaireDef.update', prize: definition.prize, sections })
    if (!response.ok) return setError(response.error.message)
    setError(null)
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 1800)
  }

  const close = () => {
    if (dirty && !window.confirm(copy.discardConfirm)) return
    onClose()
  }

  return (
    <Page
      ref={sheetRef}
      title={`${portalContent.questionnaire.title}: ${prize.title}`}
      subtitle={copy.subtitle}
      onClose={close}
      backLabel={portalContent.sheet.backTo.list}
      meta={
        <>
          <StatusBadge label={listCopy.status[definition.status]} tone={released ? 'freigeschaltet' : 'wartend'} />
          <div className={styles.editorTabs} role="group" aria-label={copy.subtitle}>
            {(['edit', 'preview'] as const).map((item) => (
              <button key={item} type="button" className={cx(styles.chip, mode === item && styles.chipActive)} aria-pressed={mode === item} onClick={() => setMode(item)}>
                {copy.tabs[item]}
              </button>
            ))}
          </div>
        </>
      }
      rail={
        mode === 'edit' ? (
          <nav aria-label={copy.sectionsNav}>
            <ol className={styles.editorNav}>
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#abschnitt-${section.id}`} className={styles.editorNavLink}>
                    <span className={styles.editorNavNum}>{index + 1}</span>
                    {section.step || copy.section(index + 1)}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : undefined
      }
      footer={
        mode === 'edit' ? (
          <>
            <div className={styles.sheetFootStart}>
              <button type="button" className={cx(styles.btn, styles.btnSecondary)} disabled={!dirty} onClick={() => window.confirm(copy.discardConfirm) && setSections(definition.sections)}>
                {copy.discard}
              </button>
              <span className={styles.savedNote} aria-live="polite">
                {justSaved ? (
                  <>
                    <Check size={14} aria-hidden="true" />
                    {copy.saved}
                  </>
                ) : dirty ? (
                  copy.unsaved
                ) : (
                  ''
                )}
              </span>
            </div>
            <button type="button" className={cx(styles.btn, styles.btnPrimary)} disabled={!dirty} onClick={save}>
              <FootLabel long={copy.save} short={copy.saveShort} />
            </button>
          </>
        ) : undefined
      }
    >
      <p className={released ? styles.notice : styles.noticeWarn} style={{ marginBottom: 20 }}>
        <Info size={16} aria-hidden="true" />
        {released ? copy.releasedNote : copy.draftNote}
      </p>
      {error && (
        <p className={styles.errorSummary} role="alert">
          {error}
        </p>
      )}

      {mode === 'preview' ? (
        <div className={styles.editorPreview}>
          <p className={styles.hint}>{copy.previewNote}</p>
          {sections.map((section) => (
            <SectionForm key={section.id} section={section} answers={previewAnswers} errors={{}} onChange={(field, value) => setPreviewAnswers((current) => ({ ...current, [field.id]: value }))} />
          ))}
        </div>
      ) : (
        <div className={styles.editor}>
          {sections.map((section, sectionIndex) => (
            <section key={section.id} id={`abschnitt-${section.id}`} className={styles.editorSection} aria-labelledby={`abschnitt-${section.id}-titel`}>
              <div className={styles.editorSectionHead}>
                <h2 className={styles.editorSectionTitle} id={`abschnitt-${section.id}-titel`}>
                  {copy.section(sectionIndex + 1)}
                  <span className={styles.editorSectionName}>{section.heading}</span>
                </h2>
                {!released && (
                  <ItemTools
                    label={copy.section(sectionIndex + 1)}
                    first={sectionIndex === 0}
                    last={sectionIndex === sections.length - 1}
                    onMove={(delta) => setSections((list) => move(list, sectionIndex, delta))}
                    onRemove={() => window.confirm(copy.removeSectionConfirm) && setSections((list) => list.filter((_, position) => position !== sectionIndex))}
                  />
                )}
              </div>
              <div className={styles.grid2}>
                <TextField label={copy.heading} value={section.heading} maxLength={140} onValueChange={(value) => updateSection(sectionIndex, { heading: value })} />
                <TextField label={copy.step} value={section.step} maxLength={40} onValueChange={(value) => updateSection(sectionIndex, { step: value })} />
              </div>
              <TextAreaField label={copy.intro} hint={copy.introHint} optional rows={2} maxLength={600} value={section.intro ?? ''} onValueChange={(value) => updateSection(sectionIndex, { intro: value || undefined })} />
              {section.criterion && (
                <details className={styles.blockDetails}>
                  <summary className={styles.blockToggle}>{copy.criterion}</summary>
                  <div className={styles.editorCriterion}>
                    <TextAreaField label={copy.criterionLead} rows={2} maxLength={400} value={section.criterion.lead} onValueChange={(value) => updateSection(sectionIndex, { criterion: { ...section.criterion!, lead: value } })} />
                    <TextAreaField label={copy.criterionText} rows={4} maxLength={1500} value={section.criterion.description} onValueChange={(value) => updateSection(sectionIndex, { criterion: { ...section.criterion!, description: value } })} />
                    <TextAreaField
                      label={copy.criterionGuidance}
                      hint={copy.criterionGuidanceHint}
                      rows={6}
                      maxLength={4000}
                      value={section.criterion.guidance.join('\n')}
                      onValueChange={(value) => updateSection(sectionIndex, { criterion: { ...section.criterion!, guidance: value.split('\n').filter((line) => line.trim()) } })}
                    />
                  </div>
                </details>
              )}

              <h3 className={styles.editorFieldsTitle}>{copy.fieldsHeading}</h3>
              <ol className={styles.editorFields}>
                {section.fields.map((field, fieldIndex) => (
                  <FieldEditor
                    key={field.id}
                    number={fieldIndex + 1}
                    field={field}
                    released={released}
                    first={fieldIndex === 0}
                    last={fieldIndex === section.fields.length - 1}
                    onChange={(patch) => updateField(sectionIndex, fieldIndex, patch)}
                    onMove={(delta) => updateSection(sectionIndex, { fields: move(section.fields, fieldIndex, delta) })}
                    onRemove={() => updateSection(sectionIndex, { fields: section.fields.filter((_, position) => position !== fieldIndex) })}
                  />
                ))}
              </ol>
              {!released && (
                <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={() => updateSection(sectionIndex, { fields: [...section.fields, newField()] })}>
                  <Plus size={15} aria-hidden="true" />
                  {copy.addField}
                  <span className={styles.srOnly}>: {copy.section(sectionIndex + 1)}</span>
                </button>
              )}
            </section>
          ))}
          {!released && (
            <button type="button" className={cx(styles.btn, styles.btnSecondary)} onClick={() => setSections((list) => [...list, newSection()])}>
              <Plus size={16} aria-hidden="true" />
              {copy.addSection}
            </button>
          )}
        </div>
      )}
    </Page>
  )
}

function ItemTools({ label, first, last, onMove, onRemove }: { label: string; first: boolean; last: boolean; onMove: (delta: number) => void; onRemove: () => void }) {
  const copy = portalContent.admin.editor
  return (
    <span className={styles.editorTools}>
      <button type="button" className={styles.iconBtn} disabled={first} onClick={() => onMove(-1)} aria-label={`${copy.moveUp}: ${label}`} title={copy.moveUp}>
        <ArrowUp size={16} aria-hidden="true" />
      </button>
      <button type="button" className={styles.iconBtn} disabled={last} onClick={() => onMove(1)} aria-label={`${copy.moveDown}: ${label}`} title={copy.moveDown}>
        <ArrowDown size={16} aria-hidden="true" />
      </button>
      <button type="button" className={cx(styles.iconBtn, styles.iconBtnDanger)} onClick={onRemove} aria-label={`${copy.remove}: ${label}`} title={copy.remove}>
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </span>
  )
}

/** Eine Frage im Editor: Text, Antwortformat, Pflicht; weitere Einstellungen aufklappbar. */
function FieldEditor({
  number,
  field,
  released,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  number: number
  field: QuestionField
  released: boolean
  first: boolean
  last: boolean
  onChange: (patch: Partial<QuestionField>) => void
  onMove: (delta: number) => void
  onRemove: () => void
}) {
  const copy = portalContent.admin.editor
  const name = `${copy.field(number)}`
  const [optionDraft, setOptionDraft] = useState(() => optionsText(field))
  const textual = field.type === 'text' || field.type === 'textarea'
  return (
    <li className={styles.editorField}>
      <div className={styles.editorFieldHead}>
        <span className={styles.editorFieldNum}>{name}</span>
        {!released && <ItemTools label={name} first={first} last={last} onMove={onMove} onRemove={onRemove} />}
      </div>
      <TextAreaField label={copy.label} rows={2} maxLength={400} value={field.label} onValueChange={(value) => onChange({ label: value })} />
      <div className={styles.editorFieldRow}>
        <SelectField
          label={copy.type}
          value={field.type}
          disabled={released}
          onValueChange={(value) => {
            const type = value as FieldType
            setOptionDraft(type === 'select' ? optionDraft : '')
            onChange({ type, options: type === 'select' ? field.options ?? [] : undefined, maxLength: type === 'text' || type === 'textarea' ? field.maxLength : undefined })
          }}
          options={FIELD_TYPES.map((type) => ({ value: type, label: FIELD_TYPE_LABEL[type] }))}
        />
        <label className={cx(styles.check, styles.editorRequired)}>
          <input type="checkbox" checked={Boolean(field.required)} disabled={released} onChange={(event) => onChange({ required: event.target.checked || undefined })} />
          <span>{copy.required}</span>
        </label>
      </div>
      {field.type === 'select' && (
        <TextAreaField
          label={copy.options}
          hint={copy.optionsHint}
          rows={4}
          maxLength={2000}
          value={optionDraft}
          disabled={released}
          onValueChange={(value) => {
            setOptionDraft(value)
            onChange({ options: parseOptions(value) })
          }}
        />
      )}
      <details className={styles.blockDetails}>
        <summary className={styles.blockToggle}>{copy.more}</summary>
        <div className={styles.editorMore}>
          <TextField label={copy.format} hint={copy.formatHint} optional maxLength={300} value={field.format ?? ''} onValueChange={(value) => onChange({ format: value || undefined })} />
          <div className={styles.grid2}>
            {textual && (
              <TextField
                label={copy.maxLength}
                optional
                inputMode="numeric"
                disabled={released}
                value={field.maxLength ? String(field.maxLength) : ''}
                onValueChange={(value) => onChange({ maxLength: value.replace(/\D/g, '') ? Number(value.replace(/\D/g, '')) : undefined })}
              />
            )}
            <SelectField
              label={copy.width}
              value={field.span ?? 'full'}
              onValueChange={(value) => onChange({ span: value as 'full' | 'half' })}
              options={[
                { value: 'full', label: copy.widthOptions.full },
                { value: 'half', label: copy.widthOptions.half },
              ]}
            />
          </div>
          <TextField label={copy.group} hint={copy.groupHint} optional maxLength={120} value={field.group ?? ''} onValueChange={(value) => onChange({ group: value || undefined })} />
        </div>
      </details>
    </li>
  )
}
