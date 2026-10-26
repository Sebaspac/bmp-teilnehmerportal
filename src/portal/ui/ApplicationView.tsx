'use client'

import React, { useId, useState } from 'react'
import { AlertCircle, File, FileImage, FileSpreadsheet, FileText, Presentation, Upload } from 'lucide-react'

import { cx } from '@/portal/ui/fields'
import { StatusBadge } from '@/portal/ui/PhaseTimeline'
import { ACCEPT_ATTRIBUTE, APPLICATION_DOCS, checkUpload, docsEditable, fileFormat, formatBytes } from '@/portal/domain/application'
import { definitionOf, displayValue, isFilled, prizeById } from '@/portal/domain/questionnaire'
import { portalContent } from '@/portal/content/portalContent'
import { sendCommand } from '@/portal/data/portalClient'
import type { AppDocKey, PortalData, ProcessState, QuestionSection, QuestionnaireAnswers, Submission, UploadedFile } from '@/portal/domain/types'
import { ReviewList, formatDateTime, type ReviewGroup } from '@/portal/ui/SubmissionSheet'
import styles from '@/portal/ui/portal.module.css'

/** Antworten eines Fragebogens als Zusammenfassung – für Prüfen, Lesen, Verwaltung und Jury. */
export function summaryGroups(sections: readonly QuestionSection[], answers: QuestionnaireAnswers): ReviewGroup[] {
  return sections.map((section, index) => ({
    title: section.heading,
    step: index,
    // Freiwillige Angaben nur zeigen, wenn ausgefüllt.
    rows: section.fields.filter((field) => field.required || isFilled(answers, field)).map((field) => [field.label, displayValue(field, answers[field.id])] as [string, string]),
  }))
}

const FORMAT_ICON: Record<string, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
  PDF: FileText,
  Word: FileText,
  Text: FileText,
  Excel: FileSpreadsheet,
  PowerPoint: Presentation,
  Bild: FileImage,
}

/** Datei mit Format und Größe, z. B. „Kennzahlen.xlsx · Excel · 86 KB“. */
export function FileLine({ file }: { file: UploadedFile }) {
  const format = fileFormat(file.fileName)
  const Icon = FORMAT_ICON[format] ?? File
  return (
    <span className={styles.fileLine}>
      <Icon size={16} aria-hidden />
      <span className={styles.fileLineName}>{file.fileName}</span>
      <span className={styles.fileLineMeta}>
        {format} · {formatBytes(file.size)}
      </span>
    </span>
  )
}

/** Die sechs Unterlagen eines Unternehmens, nur lesend (Jury, Verwaltung). */
export function DocFileList({ process }: { process: ProcessState }) {
  const copy = portalContent.jury
  return (
    <ol className={styles.docFiles}>
      {APPLICATION_DOCS.map((doc, index) => {
        const file = process.applicationDocs[doc.key]
        return (
          <li key={doc.key} className={styles.docFile}>
            <span className={styles.docNumber} aria-hidden="true">
              {index + 1}
            </span>
            <span className={styles.docFileLabel}>{doc.label}</span>
            {file ? <FileLine file={file} /> : <span className={styles.docMissing}>{copy.docMissing}</span>}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Inhalt einer Bewerbung: je gewähltem Preis der Fragebogen, dann die Unterlagen. `docs = false` für Ansichten, die
 * die Unterlagen schon an anderer Stelle zeigen.
 */
export function ApplicationContents({ data, process, docs = true, emptyText }: { data: Pick<PortalData, 'questionnaires'>; process: ProcessState; docs?: boolean; emptyText?: string }) {
  const copy = portalContent.admin.application
  const prizes = process.prizes.filter((prize) => process.questionnaires[prize])
  return (
    <div className={styles.applicationContents}>
      {prizes.length === 0 && emptyText && <p className={styles.tableEmpty}>{emptyText}</p>}
      {prizes.map((prize) => {
        const entry = process.questionnaires[prize]!
        const definition = definitionOf(data, prize)
        return (
          <section key={prize} className={styles.applicationPart} aria-labelledby={`bewerbung-${prize}`}>
            <div className={styles.applicationPartHead}>
              <h3 className={styles.sectionHeading} id={`bewerbung-${prize}`}>
                {portalContent.questionnaire.title}: {prizeById(prize).title}
              </h3>
              <StatusBadge
                label={entry.status === 'eingereicht' ? portalContent.vorgang.application.qStatus.submitted(formatDateTime(entry.submittedAt)) : portalContent.vorgang.application.qStatus.progress(entry.step + 1, (definition?.sections.length ?? 0) + 1)}
                tone={entry.status === 'eingereicht' ? 'abgeschlossen' : 'bearbeitung'}
              />
            </div>
            {definition?.sections.length ? <ReviewList groups={summaryGroups(definition.sections, entry.answers)} /> : null}
          </section>
        )
      })}
      {docs && (
        <section className={styles.applicationPart} aria-labelledby="bewerbung-unterlagen">
          <h3 className={styles.sectionHeading} id="bewerbung-unterlagen">
            {copy.docs}
          </h3>
          <DocFileList process={process} />
        </section>
      )}
    </div>
  )
}

/**
 * Unterlagen hochladen (Bewerber): je Platz Datei auswählen – sie wird sofort gespeichert und lässt sich bis zur
 * Juryprüfung austauschen. Prototyp: Es werden nur Name und Größe übertragen.
 */
export function DocUploadList({ submission }: { submission: Submission }) {
  const copy = portalContent.vorgang.application
  const editable = docsEditable(submission.process)
  const [errors, setErrors] = useState<Partial<Record<AppDocKey, string>>>({})
  const [busy, setBusy] = useState<AppDocKey | null>(null)
  const baseId = useId()

  const upload = async (key: AppDocKey, file: globalThis.File | undefined) => {
    if (!file) return
    const problem = checkUpload(file.name, file.size)
    if (problem) return setErrors((current) => ({ ...current, [key]: problem }))
    setBusy(key)
    const response = await sendCommand({ type: 'application.uploadDoc', submissionId: submission.id, key, fileName: file.name, size: file.size })
    setBusy(null)
    setErrors((current) => ({ ...current, [key]: response.ok ? undefined : response.error.message }))
  }

  return (
    <>
      <ol className={styles.docFiles}>
        {APPLICATION_DOCS.map((doc, index) => {
          const file = submission.process.applicationDocs[doc.key]
          const inputId = `${baseId}-${doc.key}`
          const error = errors[doc.key]
          return (
            <li key={doc.key} className={cx(styles.docFile, styles.docUpload)}>
              <span className={styles.docNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.docUploadText}>
                <span className={styles.docFileLabel} id={`${inputId}-label`}>
                  {doc.label}
                </span>
                <span className={styles.hint}>{doc.hint}</span>
                {file ? (
                  <span className={styles.docUploadFile}>
                    <FileLine file={file} />
                    <span className={styles.fileLineMeta}>{copy.uploaded(formatDateTime(file.uploadedAt))}</span>
                  </span>
                ) : (
                  <span className={styles.docMissing}>{copy.noFile}</span>
                )}
                {error && (
                  <span className={styles.error} id={`${inputId}-error`} role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {error}
                  </span>
                )}
              </span>
              {editable && (
                <span className={styles.docUploadAction}>
                  {/* Eigener Auswahl-Button statt des nativen Felds, dessen Text der Browser in seiner Sprache setzt. */}
                  <input
                    id={inputId}
                    type="file"
                    accept={ACCEPT_ATTRIBUTE}
                    className={cx(styles.srOnly, styles.fileInput)}
                    aria-labelledby={`${inputId}-label ${inputId}-button`}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    disabled={busy === doc.key}
                    onChange={(event) => {
                      void upload(doc.key, event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                  <label htmlFor={inputId} id={`${inputId}-button`} className={cx(styles.btn, file ? styles.btnSecondary : styles.btnPrimary, styles.btnSmall, styles.fileButton)}>
                    <Upload size={15} aria-hidden="true" />
                    {busy === doc.key ? copy.uploading : file ? copy.replace : copy.choose}
                  </label>
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <p className={styles.hint}>{editable ? copy.docsHint : copy.docsLocked}</p>
      <p className={styles.hint}>{copy.docsDemo}</p>
    </>
  )
}
