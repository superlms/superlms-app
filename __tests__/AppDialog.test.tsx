import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Modal, Text, TouchableOpacity } from 'react-native';
import { AppAlert, AppAlertHost } from '../src/components/AppDialog';

jest.mock('../src/utils/theme', () => ({
  theme: {
    colors: {
      card: '#fff',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      border: '#e2e8f0',
      primary: '#4f46e5',
      danger: '#dc2626',
      white: '#fff',
    },
    radius: { md: 10, lg: 16 },
  },
  onThemeChange: () => {},
}));

type Renderer = ReactTestRenderer.ReactTestRenderer;

const texts = (r: Renderer) => r.root.findAllByType(Text).map(t => String(t.props.children));

const button = (r: Renderer, label: string) =>
  r.root
    .findAllByType(TouchableOpacity)
    .find(b => b.findAllByType(Text).some(t => t.props.children === label))!;

const modal = (r: Renderer) => r.root.findByType(Modal);

describe('AppAlert', () => {
  let r: Renderer;

  beforeEach(() => {
    act(() => {
      r = ReactTestRenderer.create(<AppAlertHost />);
    });
  });

  afterEach(() => {
    act(() => r.unmount());
  });

  it('shows alerts one at a time and runs the pressed button', () => {
    const onDelete = jest.fn();
    act(() => {
      AppAlert.alert('Delete homework', 'Remove "Chapter 3"?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]);
      AppAlert.alert('Homework updated', 'Your changes were saved.');
    });

    expect(texts(r)).toEqual(['Delete homework', 'Remove "Chapter 3"?', 'Cancel', 'Delete']);

    act(() => button(r, 'Delete').props.onPress());
    expect(onDelete).toHaveBeenCalledTimes(1);
    // With no buttons given, the next one waiting gets a single OK.
    expect(texts(r)).toEqual(['Homework updated', 'Your changes were saved.', 'OK']);

    act(() => button(r, 'OK').props.onPress());
    expect(modal(r).props.visible).toBe(false);
  });

  it('treats Android back as the Cancel button', () => {
    const onCancel = jest.fn();
    const onLogout = jest.fn();
    act(() => {
      AppAlert.alert('Log out?', undefined, [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Log out', style: 'destructive', onPress: onLogout },
      ]);
    });

    act(() => modal(r).props.onRequestClose());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onLogout).not.toHaveBeenCalled();
    expect(modal(r).props.visible).toBe(false);
  });
});
