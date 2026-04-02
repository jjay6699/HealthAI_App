export const fetchUserProfile = async <T extends Record<string, unknown>>() => {
  const response = await fetch("/api/profile", {
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  return {
    profile: (payload?.profile && typeof payload.profile === "object" ? payload.profile : {}) as Partial<T>,
    updatedAt: typeof payload?.updatedAt === "number" ? payload.updatedAt : null
  };
};

export const saveUserProfile = async <T extends Record<string, unknown>>(profile: Partial<T>) => {
  const response = await fetch("/api/profile", {
    method: "PUT",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ profile })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  return {
    profile: (payload?.profile && typeof payload.profile === "object" ? payload.profile : {}) as Partial<T>,
    updatedAt: typeof payload?.updatedAt === "number" ? payload.updatedAt : null
  };
};
