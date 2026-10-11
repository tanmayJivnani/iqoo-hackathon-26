import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import { Button, Card, Field } from './ui';
import { api, type Draft, type ComplaintDetail } from '../lib/api';
import { categoryLabel } from '../data/civic';
import { styles } from '../features/complaints/styles';

type Props = { report: Draft | ComplaintDetail; onSaved: (draft: Draft) => void; disabled?: boolean };
function save(report: Props['report'], fields: Partial<Draft> = {}) {
  return api<Draft>('/api/v1/complaints/update-draft', { method: 'POST', body: JSON.stringify({
    complaint_id: report.complaint_id || ('id' in report ? report.id : ''),
    draft_subject_en: report.draft_subject_en, draft_body_en: report.draft_body_en,
    draft_summary_mr: report.draft_summary_mr, ...fields,
  }) });
}

export function NoticeDraft({ report, onSaved, disabled, onEditingChange }: Props & { onEditingChange: (editing: boolean) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState({ draft_subject_en: report.draft_subject_en, draft_body_en: report.draft_body_en, draft_summary_mr: report.draft_summary_mr });
  const finish = () => { setEditing(false); onEditingChange(false); };
  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try { onSaved(await save(report, fields)); finish(); }
    catch (error) { Alert.alert('Draft not saved', error instanceof Error ? error.message : 'Please retry.'); }
    finally { setSaving(false); }
  };
  return <Card>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={styles.legalTitle}>Email draft</Text>
      {!editing && <IconButton icon="pencil-outline" size={18} accessibilityLabel="Edit draft" style={{ margin: 0, width: 36, height: 36 }} onPress={() => {
        setFields({ draft_subject_en: report.draft_subject_en, draft_body_en: report.draft_body_en, draft_summary_mr: report.draft_summary_mr });
        setEditing(true); onEditingChange(true);
      }} disabled={disabled} />}
    </View>
    <Text style={styles.subtle}>Please review the details before sending. This complaint will be sent in your name.</Text>
    {editing ? <>
      <Field label="Subject" value={fields.draft_subject_en} onChangeText={value => setFields(current => ({ ...current, draft_subject_en: value }))} editable={!saving} maxLength={2000} />
      <Field label="Notice body" value={fields.draft_body_en} onChangeText={value => setFields(current => ({ ...current, draft_body_en: value }))} multiline editable={!saving} maxLength={20000} />
      <Field label="Marathi summary" value={fields.draft_summary_mr} onChangeText={value => setFields(current => ({ ...current, draft_summary_mr: value }))} multiline editable={!saving} maxLength={10000} />
      <Button title={saving ? 'Saving…' : 'Save changes'} onPress={() => void submit()} disabled={saving || disabled} />
      <Button title="Cancel editing" onPress={finish} disabled={saving} secondary />
    </> : <>
      <Text style={styles.cardTitle}>{report.draft_subject_en}</Text>
      <Text style={styles.bodyText}>{report.draft_body_en}</Text>
      <Text style={styles.legalTitle}>तक्रार गोषवारा (मराठी)</Text>
      <Text style={styles.bodyText}>{report.draft_summary_mr}</Text>
    </>}
  </Card>;
}

export function AdditionalIssues({ report, onSaved, disabled, onSavingChange }: Props & { onSavingChange: (saving: boolean) => void }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const accepted = report.accepted_additional_categories || [];
  const suggestions = report.additional_issues || [];
  const add = async (category: string) => {
    if (saving) return;
    setSaving(true); onSavingChange(true);
    try { onSaved(await save(report, { accepted_additional_categories: [...accepted, category] })); }
    catch (error) { Alert.alert('Issue not added', error instanceof Error ? error.message : 'Please retry.'); }
    finally { setSaving(false); onSavingChange(false); }
  };
  return <>{suggestions.filter(issue => !dismissed.includes(issue.category)).map(issue => <Card key={issue.category} style={styles.infoCard}>
    <Text style={styles.legalTitle}>{accepted.includes(issue.category) ? 'Added to your complaint' : 'AI noticed another issue'}</Text>
    <Text style={styles.cardTitle}>{categoryLabel(issue.category)}</Text>
    <Text style={styles.bodyText}>{issue.reason_en}</Text>
    {!accepted.includes(issue.category) && <>
      <Text style={styles.subtle}>Would you like to include this concern in the same email?</Text>
      <Button title={saving ? 'Adding…' : 'Yes, add to complaint'} onPress={() => void add(issue.category)} disabled={saving || disabled} />
      <Button title="No, skip" onPress={() => setDismissed(current => [...current, issue.category])} disabled={saving || disabled} secondary />
    </>}
  </Card>)}</>;
}
