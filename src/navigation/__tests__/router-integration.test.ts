import React from "react";
import { Text } from "react-native";
import {
  Redirect,
  Slot,
  useLocalSearchParams,
} from "expo-router";
import {
  renderRouter,
  screen,
} from "expo-router/testing-library";

import { sanitizePostLoginRedirect } from "../../auth/post-login-redirect";
import { resolvePushRoutePayload } from "../../push/pushClient";

const Layout = () => React.createElement(Slot);

const LoginGateway = () => {
  const { next } = useLocalSearchParams<{ next?: string | string[] }>();
  const destination = sanitizePostLoginRedirect(next) ?? "/student-home";
  return React.createElement(Redirect, { href: destination as never });
};

const PushGateway = () => {
  const { route, sourceId } = useLocalSearchParams<{
    route?: string;
    sourceId?: string;
  }>();
  const payload = resolvePushRoutePayload({
    route,
    params: sourceId ? { sourceId } : undefined,
  });
  return React.createElement(Redirect, {
    href: payload
      ? ({
          pathname: payload.route,
          params: payload.params,
        } as never)
      : "/notifications",
  });
};

const TrainingImportRoute = () => {
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  return React.createElement(Text, null, `training:${classId ?? ""}`);
};

const EventRoute = () => {
  const { id, sourceId } = useLocalSearchParams<{
    id?: string;
    sourceId?: string;
  }>();
  return React.createElement(Text, null, `event:${id}:${sourceId}`);
};

const StudentHomeRoute = () =>
  React.createElement(Text, null, "student-home");

const NotificationsRoute = () =>
  React.createElement(Text, null, "notifications");

const routes = {
  _layout: Layout,
  login: LoginGateway,
  "push-gateway": PushGateway,
  "training/import": TrainingImportRoute,
  "events/[id]": EventRoute,
  "student-home": StudentHomeRoute,
  notifications: NotificationsRoute,
};

describe("Expo Router critical navigation contracts", () => {
  test("restores a safe post-login deep link with its query parameters", async () => {
    const view = await renderRouter(routes, {
      initialUrl:
        "/login?next=%2Ftraining%2Fimport%3FclassId%3Dclass-1",
    });

    expect(view.getByText("training:class-1")).toBeTruthy();
    expect(screen).toHavePathname("/training/import");
    expect(screen).toHaveSearchParams({ classId: "class-1" });
  });

  test("rejects an external post-login redirect", async () => {
    const view = await renderRouter(routes, {
      initialUrl: "/login?next=https%3A%2F%2Fexample.com",
    });

    expect(view.getByText("student-home")).toBeTruthy();
    expect(screen).toHavePathname("/student-home");
  });

  test("opens a dynamic route from a push payload", async () => {
    const view = await renderRouter(routes, {
      initialUrl:
        "/push-gateway?route=%2Fevents%2Fevent-1&sourceId=notice-1",
    });

    expect(view.getByText("event:event-1:notice-1")).toBeTruthy();
    expect(screen).toHavePathname("/events/event-1");
    expect(screen).toHaveSearchParams({
      id: "event-1",
      sourceId: "notice-1",
    });
  });

  test("falls back to the notification inbox for an invalid push payload", async () => {
    const view = await renderRouter(routes, {
      initialUrl: "/push-gateway",
    });

    expect(view.getByText("notifications")).toBeTruthy();
    expect(screen).toHavePathname("/notifications");
  });
});
