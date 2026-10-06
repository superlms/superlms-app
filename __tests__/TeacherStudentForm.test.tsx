import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import Select from '../src/components/Select';
import { AppAlert } from '../src/components/AppDialog';
import * as api from '../src/api/teacherStudentApi';
import TeacherStudentFormScreen from '../src/screens/teacherStudents/TeacherStudentFormScreen';

jest.mock('../src/utils/theme', () => ({
  theme: new Proxy({}, { get: () => new Proxy({}, { get: () => '#000' }) }),
  onThemeChange: () => {},
}));
jest.mock('../src/components/VectorIcon', () => () => null);
jest.mock('../src/screens/more/docUi', () => ({ DocHeader: () => null }));
jest.mock('../src/components/AppDialog', () => ({
  AppAlert: { alert: jest.fn() },
  AppDialog: () => null,
}));
jest.mock('../src/utils/filePickers', () => ({
  apiErr: (_e: any, fallback: string) => fallback,
  pickImage: jest.fn(),
  takePhoto: jest.fn(),
}));
jest.mock('../src/api/teacherStudentApi', () => ({
  newClientRef: jest.fn(() => `ref-${Math.random()}`),
  createStudent: jest.fn(),
  updateStudent: jest.fn(),
  deleteStudent: jest.fn(),
  getMyClasses: jest.fn(),
  getStudent: jest.fn(),
  getStudentLookups: jest.fn(),
}));

type Renderer = ReactTestRenderer.ReactTestRenderer;

// The first render loads the whole of react-native.
jest.setTimeout(30000);

const mocked = api as jest.Mocked<typeof api>;
const alert = AppAlert.alert as jest.Mock;

const A = { standard_id: 5, class: 'Class 5', section_id: 11, section: 'Section A' };
const B = { standard_id: 5, class: 'Class 5', section_id: 12, section: 'Section B' };
const WHOLE = { standard_id: 5, class: 'Class 5', section_id: null, section: null };
const sectionRow = (c: typeof A) => ({ id: c.section_id, name: c.section, code: '', standard_id: c.standard_id });

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const open = async (params: any, sections: (typeof A)[]) => {
  mocked.getStudentLookups.mockResolvedValue({ classes: [], sections: sections.map(sectionRow), routes: [] } as any);
  let r!: Renderer;
  await act(async () => {
    r = ReactTestRenderer.create(<TeacherStudentFormScreen navigation={navigation} route={{ params }} />);
  });
  return r;
};

const texts = (r: Renderer) => r.root.findAllByType(Text).map(t => String(t.props.children));
const select = (r: Renderer, label: string) => r.root.findAllByType(Select).find(x => x.props.label === label);
const type = (r: Renderer, placeholder: string, value: string) =>
  act(() => r.root.findAllByType(TextInput).find(i => i.props.placeholder === placeholder)!.props.onChangeText(value));

const fill = (r: Renderer) => {
  type(r, 'Student name', 'Aarav Sharma');
  type(r, 'email@example.com', 'aarav@example.com');
  type(r, '10-digit', '9876543210');
  type(r, 'DD/MM/YYYY', '12/04/2015');
  type(r, 'Father’s name', 'Rakesh Sharma');
  act(() => select(r, 'Gender')!.props.onChange('male'));
};

const press = async (r: Renderer, label: string) => {
  const b = r.root
    .findAllByType(TouchableOpacity)
    .find(x => x.findAllByType(Text).some(t => t.props.children === label))!;
  await act(async () => b.props.onPress());
};

describe('TeacherStudentFormScreen — which section a new student goes into', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.createStudent.mockResolvedValue({} as any);
    mocked.updateStudent.mockResolvedValue({} as any);
  });

  it('never asks a class teacher of one section', async () => {
    const r = await open({ classes: [A] }, [A]);

    expect(select(r, 'Section')).toBeUndefined();
    expect(texts(r)).toContain('Class 5 · Section A');

    fill(r);
    await press(r, 'Add student');
    expect(mocked.createStudent).toHaveBeenCalledWith(expect.objectContaining({ standard_id: 5, section_id: 11 }));
  });

  it('asks a class teacher of two sections, and adds to the one picked', async () => {
    const r = await open({ classes: [A, B] }, [A, B]);

    const picker = select(r, 'Section')!;
    expect(picker.props.options).toEqual([
      { label: 'Section A', value: '5:11' },
      { label: 'Section B', value: '5:12' },
    ]);
    expect(picker.props.value).toBeNull();

    fill(r);
    await press(r, 'Add student');
    expect(alert).toHaveBeenCalledWith('Section', expect.any(String));
    expect(mocked.createStudent).not.toHaveBeenCalled();

    act(() => select(r, 'Section')!.props.onChange('5:12'));
    expect(select(r, 'Section')!.props.value).toBe('5:12');
    expect(texts(r)).toContain('Class 5 · Section B');

    await press(r, 'Add student');
    expect(mocked.createStudent).toHaveBeenCalledWith(expect.objectContaining({ standard_id: 5, section_id: 12 }));
  });

  it('asks when a whole class of two sections is theirs', async () => {
    const r = await open({ classes: [WHOLE] }, [A, B]);

    expect(select(r, 'Section')!.props.value).toBeNull();
    act(() => select(r, 'Section')!.props.onChange('5:11'));

    fill(r);
    await press(r, 'Add student');
    expect(mocked.createStudent).toHaveBeenCalledWith(expect.objectContaining({ standard_id: 5, section_id: 11 }));
  });

  it('fills the only section of a whole class by itself', async () => {
    const r = await open({ classes: [WHOLE] }, [A]);

    expect(select(r, 'Section')).toBeUndefined();
    fill(r);
    await press(r, 'Add student');
    expect(mocked.createStudent).toHaveBeenCalledWith(expect.objectContaining({ standard_id: 5, section_id: 11 }));
  });

  it('names both the class and the section when the sections are of two classes', async () => {
    const other = { standard_id: 6, class: 'Class 6', section_id: 21, section: 'Section A' };
    const r = await open({ classes: [A, other] }, [A, other]);

    expect(select(r, 'Class & Section')!.props.options.map((o: any) => o.label)).toEqual([
      'Class 5 · Section A',
      'Class 6 · Section A',
    ]);
  });

  it('edits a student in their own section without asking', async () => {
    mocked.getStudent.mockResolvedValue({
      full_name: 'Aarav Sharma', email: 'aarav@example.com', phone: '9876543210',
      dob: '2015-04-12', gender: 'male', standard_id: 5, section_id: 12,
      father_name: 'Rakesh Sharma', is_active: true, transportation_required: false,
    } as any);
    const r = await open({ id: 7, classes: [A, B] }, [A, B]);

    expect(select(r, 'Section')).toBeUndefined();
    expect(texts(r)).toContain('Class 5 · Section B');

    await press(r, 'Save changes');
    expect(mocked.updateStudent).toHaveBeenCalledWith(7, expect.objectContaining({ standard_id: 5, section_id: 12 }));
  });
});

describe('TeacherStudentFormScreen — one student however often Add is pressed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends one Add for two quick taps', async () => {
    let answer!: (v: any) => void;
    mocked.createStudent.mockReturnValue(new Promise(res => { answer = res; }) as any);
    const r = await open({ classes: [A] }, [A]);
    fill(r);

    const b = r.root
      .findAllByType(TouchableOpacity)
      .find(x => x.findAllByType(Text).some(t => t.props.children === 'Add student'))!;
    // Both taps land before the button has re-rendered as busy.
    await act(async () => {
      b.props.onPress();
      b.props.onPress();
    });
    expect(mocked.createStudent).toHaveBeenCalledTimes(1);

    await act(async () => answer({}));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('sends the same mark again when Add is pressed again after a failure', async () => {
    mocked.createStudent.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce({} as any);
    const r = await open({ classes: [A] }, [A]);
    fill(r);

    await press(r, 'Add student');
    expect(alert).toHaveBeenCalledWith('Not saved', expect.any(String));
    await press(r, 'Add student');

    expect(mocked.createStudent).toHaveBeenCalledTimes(2);
    const [first, again] = mocked.createStudent.mock.calls.map(c => c[0].client_ref);
    expect(first).toEqual(expect.any(String));
    expect(again).toBe(first);
  });

  it('sends no mark with an edit', async () => {
    mocked.updateStudent.mockResolvedValue({} as any);
    mocked.getStudent.mockResolvedValue({
      full_name: 'Aarav Sharma', email: 'aarav@example.com', phone: '9876543210',
      dob: '2015-04-12', gender: 'male', standard_id: 5, section_id: 11,
      father_name: 'Rakesh Sharma', is_active: true, transportation_required: false,
    } as any);
    const r = await open({ id: 7, classes: [A] }, [A]);

    await press(r, 'Save changes');
    expect(mocked.updateStudent.mock.calls[0][1].client_ref).toBeUndefined();
  });
});
