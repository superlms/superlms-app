import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Image, PanResponder, Text, TouchableOpacity, View } from 'react-native';
import { PhotoEditorView } from '../src/components/PhotoEditor';
import CroppedPhoto from '../src/components/CroppedPhoto';
import StudentPhotoModal from '../src/screens/teacherStudents/StudentPhotoModal';
import * as api from '../src/api/teacherStudentApi';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/components/VectorIcon', () => () => null);
jest.mock('../src/components/AppDialog', () => ({ AppAlert: { alert: jest.fn() }, AppDialog: () => null }));
jest.mock('../src/utils/filePickers', () => ({ apiErr: (_e: any, fallback: string) => fallback }));
jest.mock('../src/api/teacherStudentApi', () => ({ cropStudentPhoto: jest.fn() }));

type Renderer = ReactTestRenderer.ReactTestRenderer;

jest.setTimeout(30000);

// The touch handlers, as the editor makes them: the part kept, then the handles.
const ORDER = ['move', 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
let handlers: any[] = [];

beforeEach(() => {
  handlers = [];
  jest.spyOn(PanResponder, 'create').mockImplementation((cfg: any) => {
    handlers.push(cfg);
    return { panHandlers: {} } as any;
  });
  // A photo twice as wide as it is high.
  jest.spyOn(Image, 'getSize').mockImplementation((_uri: any, ok: any) => ok(400, 200));
});

afterEach(() => jest.restoreAllMocks());

const press = async (r: Renderer, label: string) => {
  const b = r.root
    .findAllByType(TouchableOpacity)
    .find(x => x.findAllByType(Text).some(t => t.props.children === label))!;
  await act(async () => b.props.onPress());
};

/** The editor laid out with room for the photo at its own size (400 × 200). */
const openEditor = async (onDone = jest.fn()) => {
  let r!: Renderer;
  await act(async () => {
    r = ReactTestRenderer.create(<PhotoEditorView uri="file:///p.jpg" doneLabel="Save" onCancel={jest.fn()} onDone={onDone} />);
  });
  const stage = r.root.findAllByType(View).find(v => typeof v.props.onLayout === 'function')!;
  await act(async () => stage.props.onLayout({ nativeEvent: { layout: { width: 432, height: 232 } } }));
  return r;
};

const drag = async (handle: string, dx: number, dy: number) => {
  const h = handlers[ORDER.indexOf(handle)];
  await act(async () => {
    h.onPanResponderGrant({}, {});
    h.onPanResponderMove({}, { dx, dy });
  });
};

const near = (a: any, b: any) => Object.keys(b).forEach(k => expect(a[k]).toBeCloseTo(b[k], 5));

describe('PhotoEditor — cropped from any side', () => {
  it('keeps the whole photo at first, its middle square being the list circle', async () => {
    const onDone = jest.fn();
    const r = await openEditor(onDone);

    await press(r, 'Save');
    const { crop, circle } = onDone.mock.calls[0][0];
    near(crop, { x: 0, y: 0, w: 1, h: 1 });
    near(circle, { x: 0.25, y: 0, w: 0.5, h: 1 });
    // The preview shows that circle.
    near(r.root.findByType(CroppedPhoto).props.crop, circle);
  });

  it('crops from a side and from a corner, and moves the part kept inside the photo', async () => {
    const onDone = jest.fn();
    const r = await openEditor(onDone);

    // The left side in by 100: 300 × 200 kept, its circle 200 across in the middle.
    await drag('w', 100, 0);
    await press(r, 'Save');
    near(onDone.mock.calls[0][0].crop, { x: 0.25, y: 0, w: 0.75, h: 1 });
    near(onDone.mock.calls[0][0].circle, { x: 0.375, y: 0, w: 0.5, h: 1 });

    // The bottom-right corner up and in: 200 × 100.
    await drag('se', -100, -100);
    // Moved far left: it stops at the photo's edge.
    await drag('move', -1000, 0);
    await press(r, 'Save');
    near(onDone.mock.calls[1][0].crop, { x: 0, y: 0, w: 0.5, h: 0.5 });

    // Never smaller than a finger can hold.
    await drag('se', -1000, -1000);
    await press(r, 'Save');
    near(onDone.mock.calls[2][0].crop, { x: 0, y: 0, w: 40 / 400, h: 40 / 200 });

    // Whole photo again.
    await press(r, 'Whole photo');
    await press(r, 'Save');
    near(onDone.mock.calls[3][0].crop, { x: 0, y: 0, w: 1, h: 1 });
  });
});

describe('PhotoEditor — the list circle at the top of the part kept', () => {
  it('lays the circle at the top of a tall part, in the middle across a wide one', async () => {
    const onDone = jest.fn();
    const r = await openEditor(onDone);

    // The right side in to 100 × 200: a tall part; its circle is its top square.
    await drag('e', -300, 0);
    await press(r, 'Save');
    near(onDone.mock.calls[0][0].crop, { x: 0, y: 0, w: 0.25, h: 1 });
    near(onDone.mock.calls[0][0].circle, { x: 0, y: 0, w: 0.25, h: 0.5 });
    near(r.root.findByType(CroppedPhoto).props.crop, { x: 0, y: 0, w: 0.25, h: 0.5 });

    // Moved down and right: still the top of the part kept.
    await drag('move', 100, 0);
    await drag('n', 0, 50);
    await press(r, 'Save');
    near(onDone.mock.calls[1][0].crop, { x: 0.25, y: 0.25, w: 0.25, h: 0.75 });
    near(onDone.mock.calls[1][0].circle, { x: 0.25, y: 0.25, w: 0.25, h: 0.5 });
  });
});

describe('StudentPhotoModal — the list photo large, cropped and saved there', () => {
  const student = { id: 7, user_id: 70, full_name: 'Aarav Sharma', image: 'https://cdn.test/a.jpg', is_active: true } as any;

  it('turns into the editor on Crop, and Save saves the part kept', async () => {
    (api.cropStudentPhoto as jest.Mock).mockResolvedValue('https://cdn.test/a-cut.jpg');
    const onSaved = jest.fn();
    let r!: Renderer;
    await act(async () => {
      r = ReactTestRenderer.create(<StudentPhotoModal student={student} onClose={jest.fn()} onSaved={onSaved} />);
    });

    expect(r.root.findAllByType(PhotoEditorView)).toHaveLength(0);
    // The crop button is the first of the two round ones (crop, close).
    const crop = r.root.findAllByType(TouchableOpacity)[0];
    await act(async () => crop.props.onPress());
    const editor = r.root.findByType(PhotoEditorView);
    expect(editor.props.uri).toBe('https://cdn.test/a.jpg');

    const edit = { crop: { x: 0, y: 0, w: 0.5, h: 1 }, circle: { x: 0, y: 0, w: 0.5, h: 1 } };
    await act(async () => editor.props.onDone(edit));

    expect(api.cropStudentPhoto).toHaveBeenCalledWith(7, edit.crop);
    expect(onSaved).toHaveBeenCalledWith(7, 'https://cdn.test/a-cut.jpg');
    // Back to the large photo, now the new one.
    expect(r.root.findAllByType(PhotoEditorView)).toHaveLength(0);
    expect(r.root.findAllByType(Image).some(i => i.props.source?.uri === 'https://cdn.test/a-cut.jpg')).toBe(true);
  });
});
