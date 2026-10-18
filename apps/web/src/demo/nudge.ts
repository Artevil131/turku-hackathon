const KEY = "yl.demoOpened";

/** The arrow beside the Researcher demo shows until that demo has been opened. */
export const nudgeOn = (): boolean => {
  try {
    return !localStorage.getItem(KEY);
  } catch {
    return true;
  }
};

export const nudgeOff = (): void => {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* the arrow just stays */
  }
};
