var LOCALES = {
  en: {
    lock: 'Lock note',
    unlock: 'Unlock note',
    edit: 'Edit note',
    delete: 'Delete note',
    add_note: 'Add Note',
    view_outline: 'View Outline',
    export_notes: 'Export notes (JSON)',
    import_notes: 'Import notes (JSON)',
    outline_title: 'Note outline',
    outline_title_count: 'Note outline ({count})',
    outline_empty: '(no text)',
    no_notes_export: 'No notes to export.',
    export_ok: 'Exported {count} note(s) successfully.',
    import_ok: 'Import completed.',
    import_invalid: 'Error: the file does not contain valid JSON.',
    lang_label: 'Language:',
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
    outline_title: 'Esquema de notas',
    outline_title_count: 'Esquema de notas ({count})',
    outline_empty: '(sin texto)',
    no_notes_export: 'No hay notas para exportar.',
    export_ok: 'Exportadas {count} nota(s) correctamente.',
    import_ok: 'Importación completada.',
    import_invalid: 'Error: el archivo no contiene JSON válido.',
    lang_label: 'Idioma:',
  },
};

var __lang = 'en';

function setLang(lang) {
  if (LOCALES[lang]) __lang = lang;
}

function getText(key, replacements) {
  var str = (LOCALES[__lang] && LOCALES[__lang][key]) || LOCALES['en'][key] || key;
  if (replacements) {
    str = str.replace(/\{(\w+)\}/g, function (m, name) {
      return replacements[name] !== undefined ? replacements[name] : m;
    });
  }
  return str;
}
