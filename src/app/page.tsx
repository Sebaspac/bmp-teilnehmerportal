import { redirect } from 'next/navigation'

// Dieses Projekt enthält nur das Teilnehmerportal; die Website mit Startseite ist ein eigenes Projekt.
export default function Home() {
  redirect('/portal')
}
