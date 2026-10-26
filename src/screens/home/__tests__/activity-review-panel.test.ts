/* eslint-disable import/first */
const mockSave = jest.fn(async () => undefined);
const mockLoad = jest.fn(async () => ({attendance:[],reviews:[],enrolledClassIds:new Set(['a'])}));
jest.mock("../../../api/activity-review",()=>({
  loadActivityReview: (...args: unknown[])=>mockLoad(...args as []),
  saveActivityReview:(...args:unknown[])=>mockSave(...args as []),
}));
jest.mock("../../../api/holiday-decisions",()=>({listCalendarPauses:async()=>[]}));
jest.mock("../../../ui/app-theme",()=>({useAppTheme:()=>({colors:{card:'#162033',border:'#333',text:'#fff',muted:'#aaa',successText:'#0f0',successBg:'#030',inputBg:'#111',dangerText:'#f00'}})}));
jest.mock("../../../ui/icon-registry",()=>({GoAtletaIcon:()=>null}));
jest.mock("../../../ui/ModalSheet",()=>({ModalSheet:({visible,children}: {visible:boolean;children:unknown})=>visible?children:null}));
jest.mock("../../../ui/DateInput",()=>({DateInput:()=>null}));
jest.mock("../../../core/activity-notice",()=>({claimActivityNotice:async()=>true}));
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ActivityReviewSuggestion } from "../ActivityReviewSuggestion";
import type { ClassGroup } from "../../../core/models";
const classes=[{id:'a',name:'Turma de teste',unit:'Unidade',createdAt:'2026-08-01',cycleStartDate:'2026-08-01',daysOfWeek:[1,3,5]} as ClassGroup];
it("keeps suggestions read-only until the explicit confirmation and records held classes without inventing attendance",async()=>{
  const onSaved=jest.fn(async()=>undefined);
  const screen=render(React.createElement(ActivityReviewSuggestion,{organizationId:'org-test',userId:'user-test',classes,today:'2026-09-07',onPresence:()=>undefined,onSaved}));
  await waitFor(()=>expect(screen.getByText('Revisar período')).toBeTruthy(), { timeout: 10000 });
  fireEvent.press(screen.getByText('Revisar período'));
  expect(mockSave).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('A aula aconteceu'));
  expect(mockSave).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Confirmar'));
  await waitFor(()=>expect(mockSave).toHaveBeenCalledWith('org-test',['a'],expect.any(String),'2026-09-04','held'));
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it("hides the previous organization's suggestions and panel while the new read is pending",async()=>{
  const screen=render(React.createElement(ActivityReviewSuggestion,{organizationId:'org-A',userId:'user-test',classes,today:'2026-09-07',onPresence:()=>undefined,onSaved:async()=>undefined}));
  await waitFor(()=>expect(screen.getByText('Revisar período')).toBeTruthy());
  fireEvent.press(screen.getByText('Revisar período'));
  expect(screen.getByText('Confirmar')).toBeTruthy();
  mockLoad.mockImplementationOnce(()=>new Promise(()=>{}));
  screen.rerender(React.createElement(ActivityReviewSuggestion,{organizationId:'org-B',userId:'user-test',classes,today:'2026-09-07',onPresence:()=>undefined,onSaved:async()=>undefined}));
  expect(screen.queryByText('Confirmar')).toBeNull();
  expect(screen.queryByText('Revisar período')).toBeNull();
  screen.unmount();
});
