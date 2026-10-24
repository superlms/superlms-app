import { claimUploads, filesIn, getTransfers, startTransfer } from '../src/utils/transfers';
import { busyLabelOf } from '../src/components/SavingButton';

jest.mock('../src/utils/theme', () => ({
  theme: new Proxy({}, { get: () => new Proxy({}, { get: () => '#000' }) }),
  onThemeChange: () => {},
}));
jest.mock('../src/components/VectorIcon', () => () => null);

describe('transfers', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('follows a file from start to done, then lets it go', () => {
    const t = startTransfer('download', 'Receipt.pdf');
    const id = getTransfers()[getTransfers().length - 1].id;
    const now = () => getTransfers().find(x => x.id === id);

    expect(now()).toMatchObject({ kind: 'download', label: 'Receipt.pdf', progress: null, state: 'running' });
    t.update(50, 200);
    expect(now()?.progress).toBeCloseTo(0.25);
    // A size not known yet changes nothing.
    t.update(80, -1);
    expect(now()?.progress).toBeCloseTo(0.25);

    t.done();
    expect(now()).toMatchObject({ state: 'done', progress: 1 });
    jest.advanceTimersByTime(2000);
    expect(now()).toBeUndefined();
  });

  it('leaves an upload to the saving button that claimed it', () => {
    const release = claimUploads();
    startTransfer('upload', 'photo.jpg');
    expect(getTransfers()[getTransfers().length - 1].claimed).toBe(true);
    release();

    startTransfer('upload', 'other.jpg');
    expect(getTransfers()[getTransfers().length - 1].claimed).toBe(false);
  });

  it('finds the files a request carries', () => {
    const one = { _parts: [['name', 'Aarav'], ['image', { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' }]] };
    const two = { _parts: [['a', { uri: 'file:///a.pdf', name: 'a.pdf' }], ['b', { uri: 'file:///b.pdf', name: 'b.pdf' }]] };
    const none = { _parts: [['email', 'x@y.z'], ['password', 'secret']] };
    expect(filesIn(one)).toBe('a.jpg');
    expect(filesIn(two)).toBe('2 files');
    expect(filesIn(none)).toBeNull();
    expect(filesIn({ email: 'x' })).toBeNull();
    expect(filesIn(undefined)).toBeNull();
  });
});

describe('busyLabelOf', () => {
  it('says what a button is doing from what it says at rest', () => {
    expect(busyLabelOf('Save changes')).toBe('Saving changes');
    expect(busyLabelOf('Post assignment')).toBe('Posting assignment');
    expect(busyLabelOf('Send to school')).toBe('Sending to school');
    expect(busyLabelOf('Approve & make receipt')).toBe('Approving');
    expect(busyLabelOf('Sending…')).toBe('Saving');
    expect(busyLabelOf('Update')).toBe('Updating');
  });
});
