import type { TagEntity } from '../db';

type CsvRow = string[];

export function parseTagsCsv(content: string): TagEntity[] {
  const rows = parseCsvRows(content)
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (rows.length < 2) {
    return [];
  }

  const header = rows[0].map(normalizeHeader);
  const dataRows = rows.slice(1);

  return dataRows.map((row) => {
    const tagNumber = getValue(row, header, ['tag_number', 'tagnumber']);
    const description = getValue(row, header, ['description']);
    const area = getValue(row, header, ['area']);
    const unit = getValue(row, header, ['unit']);
    const service = getValue(row, header, ['service']);

    if (!tagNumber || !description || !area || !unit || !service) {
      throw new Error('Each row must include tag_number, description, area, unit, service.');
    }

    return {
      tagNumber,
      type: getValue(row, header, ['type', 'instrument_type']) || inferTagType(tagNumber),
      plant: getValue(row, header, ['plant', 'facility']),
      instrumentRole: getValue(row, header, ['instrument_role', 'role', 'function', 'loop_function']),
      safetyLayer: getValue(row, header, ['safety_layer', 'safety', 'protection_layer']),
      votingLogic: getValue(row, header, ['voting_logic', 'voting', 'sif_voting']),
      controlSystem: getValue(row, header, ['control_system', 'controller_system', 'control_mode']),
      silTarget: getValue(row, header, ['sil_target', 'sil']),
      proofTestInterval: getValue(row, header, ['proof_test_interval', 'proof_test', 'proof_interval']),
      bypassPermitRequired: getValue(row, header, ['bypass_permit_required', 'bypass_permit', 'permit_required']),
      functionalOwner: getValue(row, header, ['functional_owner', 'owner', 'system_owner']),
      description,
      area,
      unit,
      service,
      lrv: getValue(row, header, ['lrv']),
      urv: getValue(row, header, ['urv']),
      engUnit: getValue(row, header, ['eng_unit', 'engunit']),
      transferFunction: getValue(row, header, ['transfer_function', 'transferfunction']),
      failSafe: getValue(row, header, ['fail_safe', 'failsafe']),
      maxError: getValue(row, header, ['max_error', 'maxerror']),
      testEquipment: getValue(row, header, ['test_equipment', 'testequipment']),
      testEquipmentCalDate: getValue(row, header, ['test_equip_cal_date', 'testequipmentcaldate'])
    };
  });
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function getValue(row: CsvRow, header: string[], aliases: string[]): string {
  const index = header.findIndex((field) => aliases.includes(field));
  if (index < 0) {
    return '';
  }
  return row[index]?.trim() ?? '';
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function inferTagType(tagNumber: string): string {
  const inferred = tagNumber.trim().match(/^[A-Za-z]+/)?.[0] ?? '';
  return inferred.toUpperCase();
}
