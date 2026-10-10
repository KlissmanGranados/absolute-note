const LOCALES = {
  en: {
    lock: 'Lock note',
    unlock: 'Unlock note',
    edit: 'Edit note',
    delete: 'Delete note',
    add_note: 'Add Note',
    view_outline: 'View Outline',
    export_notes: 'Export notes (JSON)',
    import_notes: 'Import notes (JSON)',
    hide_notes: 'Hide all notes',
    show_notes: 'Show all notes',
    outline_title: 'Note outline',
    outline_title_count: 'Note outline ({count})',
    outline_empty: '(no text)',
    no_notes_export: 'No notes to export.',
    export_ok: 'Exported {count} note(s) successfully.',
    import_summary: 'Import completed. {count} note(s) added — {pages} page(s), {total} note(s) in storage.',
    import_invalid: 'Error: the file does not contain valid JSON.',
    recovery: 'Recovery',
    lang_label: 'Language:',
    customize_notes: 'Customize notes',
    note_width: 'Width (px)',
    note_height: 'Height (px)',
    note_font_size: 'Font size (px)',
    prefs_saved: 'Settings saved.',
    back: 'Back',
    save: 'Save',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    font_size: 'Font size',
    create_note: 'Create note',
    close: 'Close',
    eject_outline: 'Open outline in a window',
    no_notes_empty: 'No notes on this page',
    outline_target_lost: 'The page for these notes is no longer available.',
  },
  es: {
    lock: 'Bloquear nota',
    unlock: 'Desbloquear nota',
    edit: 'Editar nota',
    delete: 'Eliminar nota',
    add_note: 'Agregar Nota',
    view_outline: 'Ver esquema',
    export_notes: 'Exportar notas (JSON)',
    import_notes: 'Importar notas (JSON)',
    hide_notes: 'Ocultar notas',
    show_notes: 'Mostrar notas',
    outline_title: 'Esquema de notas',
    outline_title_count: 'Esquema de notas ({count})',
    outline_empty: '(sin texto)',
    no_notes_export: 'No hay notas para exportar.',
    export_ok: 'Exportadas {count} nota(s) correctamente.',
    import_summary: 'Importación completada. {count} nota(s) agregada(s) — {pages} página(s), {total} nota(s) en storage.',
    import_invalid: 'Error: el archivo no contiene JSON válido.',
    recovery: 'Recuperación',
    lang_label: 'Idioma:',
    customize_notes: 'Personalizar notas',
    note_width: 'Ancho (px)',
    note_height: 'Alto (px)',
    note_font_size: 'Tamaño de fuente (px)',
    prefs_saved: 'Ajustes guardados.',
    back: 'Volver',
    save: 'Guardar',
    bold: 'Negrita',
    italic: 'Cursiva',
    underline: 'Subrayado',
    font_size: 'Tamaño de fuente',
    create_note: 'Crear nota',
    close: 'Cerrar',
    eject_outline: 'Abrir esquema en una ventana',
    no_notes_empty: 'No hay notas en esta página',
    outline_target_lost: 'La página de estas notas ya no está disponible.',
  },
};

export const DEFAULT_LANG = 'en';

let currentLang = DEFAULT_LANG;

export function setLang(lang) {
  if (LOCALES[lang]) currentLang = lang;
}

export function getLang() {
  return currentLang;
}

export function getText(key, replacements) {
  let str = LOCALES[currentLang][key] || LOCALES[DEFAULT_LANG][key] || key;
  if (replacements) {
    str = str.replace(/\{(\w+)\}/g, (match, name) => (replacements[name] !== undefined ? replacements[name] : match));
  }
  return str;
}
