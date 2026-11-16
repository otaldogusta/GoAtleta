import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Image, Platform } from "react-native";
import { ProfileAvatarPhoto } from "../ProfileAvatarPhoto";

jest.mock("react-native", () => ({ Image: "Image", Platform: { OS: "web" } }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const avatar = "https://qa.example.test/storage/v1/object/public/profile-photos/fixture/avatar";
let view: TestRenderer.ReactTestRenderer;

const renderPhoto = (uri: string) => {
  act(() => { view = TestRenderer.create(React.createElement(ProfileAvatarPhoto, { uri, size: 54 })); });
};

afterEach(() => {
  act(() => view.unmount());
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
});

it("offers the versioned JXL companion and retains JPEG after a source error", () => {
  const jpeg = avatar + "?v=123&jxl=1";
  renderPhoto(jpeg);

  expect(view.root.findByType("source").props).toMatchObject({
    type: "image/jxl",
    srcSet: avatar + ".jxl?v=123",
  });
  const img = view.root.findByType("img");
  expect(img.props).toMatchObject({ src: jpeg, alt: "" });

  act(() => img.props.onError());
  expect(view.root.findAllByType("source")).toHaveLength(0);
  expect(view.root.findByType("img").props.src).toBe(jpeg);

  act(() => view.update(React.createElement(ProfileAvatarPhoto, { uri: avatar + "?v=124&jxl=1", size: 54 })));
  expect(view.root.findByType("source").props.srcSet).toBe(avatar + ".jxl?v=124");
});

it.each([
  avatar + "?v=123",
  avatar + "?jxl=1",
  "https://qa.example.test/storage/v1/object/public/student-photos/fixture/avatar?v=123&jxl=1",
  "https://qa.example.test/assets/avatar?v=123&jxl=1",
])("uses the regular image for %s", (uri) => {
  renderPhoto(uri);
  expect(view.root.findAllByType("picture")).toHaveLength(0);
  expect(view.root.findByType(Image).props.source).toEqual({ uri });
});

it("uses the regular image on native even when a JXL companion was stored", () => {
  Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
  const uri = avatar + "?v=123&jxl=1";
  renderPhoto(uri);
  expect(view.root.findAllByType("picture")).toHaveLength(0);
  expect(view.root.findByType(Image).props.source).toEqual({ uri });
});
