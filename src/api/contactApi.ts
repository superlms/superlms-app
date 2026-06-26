import apiClient from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ContactPayload {
  subject: string;
  message: string;
  attachment?: { name: string; uri: string; type?: string } | null;
}

export interface ContactQuery {
  id: string | number;
  subject: string;
  message: string;
  status: 'Pending' | 'In Progress' | 'Resolved';
  created_at: string;
  admin_reply?: string | null;
  replied_at?: string | null;
}

export interface ContactListResponse {
  data: ContactQuery[];
}

// ════════════════════════════════════════════════════════════════════════════
//  STUDENT APIs
// ════════════════════════════════════════════════════════════════════════════

// Build the request body: multipart when a file is attached, JSON otherwise.
// The query field name differs by role: students send `student_query`, teachers
// send `teacher_query` (the backend validates these names per endpoint).
const buildContactRequest = (
  payload: ContactPayload,
  queryField: 'student_query' | 'teacher_query',
) => {
  if (payload.attachment?.uri) {
    const formData = new FormData();
    formData.append('topic', payload.subject);
    formData.append(queryField, payload.message);
    formData.append('image', {
      uri: payload.attachment.uri,
      name: payload.attachment.name,
      type: payload.attachment.type ?? 'image/jpeg',
    } as any);
    return {
      body: formData as any,
      headers: { 'Content-Type': 'multipart/form-data' },
    };
  }
  return {
    body: { topic: payload.subject, [queryField]: payload.message },
    headers: { 'Content-Type': 'application/json' },
  };
};

// POST /user/admin/contact - multipart when an attachment is present
export const studentContactAdmin = async (payload: ContactPayload) => {
  const { body, headers } = buildContactRequest(payload, 'student_query');

  console.log('[studentContactAdmin] Sending, hasAttachment:', !!payload.attachment);

  const { data } = await apiClient.post('/user/admin/contact', body, { headers });

  console.log('[studentContactAdmin] Response:', JSON.stringify(data, null, 2));
  return data;
};

// GET /user/admin/contact-list
export const getStudentContactList = async (): Promise<any> => {
  const { data } = await apiClient.get('/user/admin/contact-list');
  console.log('[getStudentContactList] Response received');
  return data;
};

// POST /user/admin/contact-reply - This is a POST API to get reply
export const getStudentContactReply = async (contact_id: string | number) => {
  const requestData = {
    contact_id: contact_id,
  };
  console.log('[getStudentContactReply] Sending:', requestData);
  
  const { data } = await apiClient.post('/user/admin/contact-reply', requestData, {
    headers: { 'Content-Type': 'application/json' },
  });
  console.log('[getStudentContactReply] Response:', JSON.stringify(data, null, 2));
  return data;
};

// ════════════════════════════════════════════════════════════════════════════
//  TEACHER APIs
// ════════════════════════════════════════════════════════════════════════════

// POST /teacher/admin/contact - multipart when an attachment is present
export const teacherContactAdmin = async (payload: ContactPayload) => {
  const { body, headers } = buildContactRequest(payload, 'teacher_query');

  console.log('[teacherContactAdmin] Sending, hasAttachment:', !!payload.attachment);

  const { data } = await apiClient.post('/teacher/admin/contact', body, { headers });

  console.log('[teacherContactAdmin] Response:', JSON.stringify(data, null, 2));
  return data;
};

// GET /teacher/admin/contact-list
export const getTeacherContactList = async (): Promise<any> => {
  const { data } = await apiClient.get('/teacher/admin/contact-list');
  console.log('[getTeacherContactList] Response received');
  return data;
};

// POST /teacher/admin/contact-reply - This is a POST API to get reply
export const getTeacherContactReply = async (contact_id: string | number) => {
  const requestData = {
    contact_id: contact_id,
  };
  console.log('[getTeacherContactReply] Sending:', requestData);
  
  const { data } = await apiClient.post('/teacher/admin/contact-reply', requestData, {
    headers: { 'Content-Type': 'application/json' },
  });
  console.log('[getTeacherContactReply] Response:', JSON.stringify(data, null, 2));
  return data;
};