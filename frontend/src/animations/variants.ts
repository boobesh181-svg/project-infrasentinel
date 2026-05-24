export const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 }
};

export const fadeInLeft = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0 }
};

export const fadeInRight = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0 }
};

export const panelReveal = {
  hidden: { opacity: 0, y: 18, scale: 0.985, filter: "blur(10px)" },
  visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
};

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.03
    }
  }
};

export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 }
};

export const softPulse = {
  initial: { opacity: 0.45, scale: 0.98 },
  animate: {
    opacity: [0.45, 0.82, 0.45],
    scale: [0.98, 1, 0.98],
    transition: {
      duration: 2.8,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export const scanLine = {
  initial: { y: "-10%", opacity: 0.15 },
  animate: {
    y: ["-10%", "110%"],
    opacity: [0.15, 0.3, 0.15],
    transition: {
      duration: 3.8,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

export const fadeUp = fadeInUp;
export const fadeLeft = fadeInLeft;
export const fadeRight = fadeInRight;
