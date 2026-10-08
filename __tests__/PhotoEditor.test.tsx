import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Image, PanResponder, Text, TouchableOpacity, View } from 'react-native';
import { PhotoEditorView } from '../src/components/PhotoEditor';
import { PhotoCircleView } from '../src/components/PhotoCircle';
import CroppedPhoto from '../src/components/CroppedPhoto';
import StudentPhotoModal from '../src/screens/teacherStudents/StudentPhotoModal';
import * as api from '../src/api/teacherStudentApi';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/components/VectorIcon', () => () => null);
jest.mock('../src/components/AppDialog', () => ({ AppAlert: { alert: jest.fn() }, AppDialog: () => null }));
jest.mock('../src/utils/filePickers', () => ({ apiErr: (_e: any, fallback: string) => fallback }));
jest.mock('../src/api/teacherStudentApi', () => ({ cropStudentPhoto: jest.fn(), setStudentPhotoCircle: jest.fn() }));

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
describe('PhotoEditor — crop only (the large photo from the list)', () => {
  it('shows no circle and no list preview, and still crops', async () => {
    const onDone = jest.fn();
    let r!: Renderer;
    await act(async () => {
      r = ReactTestRenderer.create(
        <PhotoEditorView uri="file:///p.jpg" doneLabel="Save" showCircle={false} onCancel={jest.fn()} onDone={onDone} />,
      );
    });
    const stage = r.root.findAllByType(View).find(v => typeof v.props.onLayout === 'function')!;
    await act(async () => stage.props.onLayout({ nativeEvent: { layout: { width: 432, height: 232 } } }));

    expect(r.root.findAllByType(CroppedPhoto)).toHaveLength(0);
    expect(r.root.findAllByType(Text).some(t => t.props.children === 'In the list')).toBe(false);
    const dashed = r.root
      .findAllByType(View)
      .filter(v => ([] as any[]).concat(v.props.style).flat().some((x: any) => x?.borderStyle === 'dashed'));
    expect(dashed).toHaveLength(0);

    await drag('w', 100, 0);
    await press(r, 'Save');
    near(onDone.mock.calls[0][0].crop, { x: 0.25, y: 0, w: 0.75, h: 1 });
  });
});

describe('PhotoCircle — the list circle set by moving and zooming the photo', () => {
  /** The tool laid out 300 square: the circle 260 across. The photo is 400 × 200. */
  const openCircle = async (onDone = jest.fn(), circle: any = null) => {
    let r!: Renderer;
    await act(async () => {
      r = ReactTestRenderer.create(
        <PhotoCircleView uri="file:///p.jpg" circle={circle} onCancel={jest.fn()} onDone={onDone} />,
      );
    });
    const stage = r.root.findAllByType(View).find(v => typeof v.props.onLayout === 'function')!;
    await act(async () => stage.props.onLayout({ nativeEvent: { layout: { width: 300, height: 300 } } }));
    return r;
  };
  const zoomBtn = async (r: Renderer, label: string) => {
    const b = r.root.findAllByType(TouchableOpacity).find(x => x.props.accessibilityLabel === label)!;
    await act(async () => b.props.onPress());
  };
  const move = async (e: any, g: any) => {
    await act(async () => handlers[0].onPanResponderMove(e, g));
  };

  it('opens at the top of the photo, as the list shows it with none set', async () => {
    const onDone = jest.fn();
    const r = await openCircle(onDone);
    await press(r, 'Save');
    near(onDone.mock.calls[0][0], { x: 0.25, y: 0, w: 0.5, h: 1 });
    near(r.root.findByType(CroppedPhoto).props.crop, { x: 0.25, y: 0, w: 0.5, h: 1 });
  });

  it('opens where the circle was set before', async () => {
    const onDone = jest.fn();
    const r = await openCircle(onDone, { x: 0.5, y: 0.25, w: 0.25, h: 0.5 });
    await press(r, 'Save');
    near(onDone.mock.calls[0][0], { x: 0.5, y: 0.25, w: 0.25, h: 0.5 });
  });

  it('zooms in and out with + and −, about the middle, never past the photo', async () => {
    const onDone = jest.fn();
    const r = await openCircle(onDone);

    // In: the circle takes 160 of the photo, about its middle (200, 100).
    await zoomBtn(r, 'Zoom in');
    await press(r, 'Save');
    near(onDone.mock.calls[0][0], { x: 0.3, y: 0.1, w: 0.4, h: 0.8 });

    // Out twice: back to the whole height — no further.
    await zoomBtn(r, 'Zoom out');
    await zoomBtn(r, 'Zoom out');
    await press(r, 'Save');
    near(onDone.mock.calls[1][0], { x: 0.25, y: 0, w: 0.5, h: 1 });
  });

  it('moves the photo under the circle with a finger and zooms with two', async () => {
    const onDone = jest.fn();
    const r = await openCircle(onDone);

    // The photo dragged right by 26 on screen (1.3 to a photo pixel): the circle 20 further left.
    await act(async () => handlers[0].onPanResponderGrant({}, {}));
    await move({ nativeEvent: { touches: [{ pageX: 0, pageY: 0 }] } }, { dx: 26, dy: 0 });
    await press(r, 'Save');
    near(onDone.mock.calls[0][0], { x: 0.2, y: 0, w: 0.5, h: 1 });

    // Fingers twice as far apart: half the circle, about its middle (180, 100).
    await act(async () => handlers[0].onPanResponderGrant({}, {}));
    await move({ nativeEvent: { touches: [{ pageX: 0, pageY: 0 }, { pageX: 100, pageY: 0 }] } }, { dx: 0, dy: 0 });
    await move({ nativeEvent: { touches: [{ pageX: 0, pageY: 0 }, { pageX: 200, pageY: 0 }] } }, { dx: 0, dy: 0 });
    await press(r, 'Save');
    near(onDone.mock.calls[1][0], { x: 0.325, y: 0.25, w: 0.25, h: 0.5 });

    // Dragged far off: it stops at the photo's edge.
    await act(async () => handlers[0].onPanResponderGrant({}, {}));
    await move({ nativeEvent: { touches: [{ pageX: 0, pageY: 0 }] } }, { dx: -5000, dy: -5000 });
    await press(r, 'Save');
    near(onDone.mock.calls[2][0], { x: 0.75, y: 0.5, w: 0.25, h: 0.5 });
  });
});

describe('StudentPhotoModal — Profile sets the list circle, the photo left as it is', () => {
  const student = {
    id: 7,
    user_id: 70,
    full_name: 'Aarav Sharma',
    image: 'https://cdn.test/a.jpg',
    is_active: true,
    photo_circle: { x: 0.1, y: 0, w: 0.5, h: 1 },
  } as any;

  it('shows Crop, Profile and Close; Crop is crop only; Profile saves the circle', async () => {
    (api.setStudentPhotoCircle as jest.Mock).mockResolvedValue({ x: 0.2, y: 0, w: 0.5, h: 1 });
    (api.cropStudentPhoto as jest.Mock).mockClear();
    const onSaved = jest.fn();
    const onCircleSaved = jest.fn();
    let r!: Renderer;
    await act(async () => {
      r = ReactTestRenderer.create(
        <StudentPhotoModal student={student} onClose={jest.fn()} onSaved={onSaved} onCircleSaved={onCircleSaved} />,
      );
    });

    // The whole photo, not cut to a square.
    const big = r.root.findAllByType(Image).find(i => i.props.source?.uri === 'https://cdn.test/a.jpg')!;
    expect(big.props.resizeMode).toBe('contain');
    const buttons = r.root.findAllByType(TouchableOpacity);
    expect(buttons).toHaveLength(3);

    // Crop: the editor without the circle.
    await act(async () => buttons[0].props.onPress());
    expect(r.root.findByType(PhotoEditorView).props.showCircle).toBe(false);
    await act(async () => r.root.findByType(PhotoEditorView).props.onCancel());

    // Profile: the circle tool, at the circle set before.
    const profile = r.root.findAllByType(TouchableOpacity).find(b => b.props.accessibilityLabel === 'Profile photo')!;
    await act(async () => profile.props.onPress());
    const tool = r.root.findByType(PhotoCircleView);
    expect(tool.props.uri).toBe('https://cdn.test/a.jpg');
    expect(tool.props.circle).toEqual({ x: 0.1, y: 0, w: 0.5, h: 1 });

    await act(async () => tool.props.onDone({ x: 0.2, y: 0, w: 0.5, h: 1 }));
    expect(api.setStudentPhotoCircle).toHaveBeenCalledWith(7, { x: 0.2, y: 0, w: 0.5, h: 1 });
    expect(onCircleSaved).toHaveBeenCalledWith(7, { x: 0.2, y: 0, w: 0.5, h: 1 });
    expect(onSaved).not.toHaveBeenCalled();
    expect(api.cropStudentPhoto).not.toHaveBeenCalled();

    // Back to the large photo; opened again, Profile starts at the new circle.
    expect(r.root.findAllByType(PhotoCircleView)).toHaveLength(0);
    const again = r.root.findAllByType(TouchableOpacity).find(b => b.props.accessibilityLabel === 'Profile photo')!;
    await act(async () => again.props.onPress());
    expect(r.root.findByType(PhotoCircleView).props.circle).toEqual({ x: 0.2, y: 0, w: 0.5, h: 1 });
  });
});
