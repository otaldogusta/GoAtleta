import { validReviewDraft, type ReviewDraft } from "../ActivityReviewPanel";
const base: ReviewDraft = { reason:"tournament",start:"2026-09-07",end:"2026-09-07",resolution:null,newDate:"",note:"" };
test("requires the tournament outcome and a single original date for rescheduling", () => {
  expect(validReviewDraft(base,["a"])).toBe(false);
  expect(validReviewDraft({...base,resolution:"replaced"},["a"])).toBe(true);
  expect(validReviewDraft({...base,resolution:"rescheduled",newDate:"2026-09-09"},["a"])).toBe(true);
  expect(validReviewDraft({...base,end:"2026-09-08",resolution:"rescheduled",newDate:"2026-09-09"},["a"])).toBe(false);
  expect(validReviewDraft({...base,resolution:"rescheduled",newDate:"2026-09-06"},["a"])).toBe(false);
});
test("requires a meaningful other reason and rejects impossible dates or empty selection", () => {
  expect(validReviewDraft({...base,reason:"other",note:"  "},["a"])).toBe(false);
  expect(validReviewDraft({...base,reason:"other",note:"Quadra interditada"},["a"])).toBe(true);
  expect(validReviewDraft({...base,reason:"held",start:"2026-02-30"},["a"])).toBe(false);
  expect(validReviewDraft({...base,reason:"held"},[])).toBe(false);
});
