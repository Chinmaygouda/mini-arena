/**
 * Authoritative weapon-specific and action-specific finger grip poses for Drillimpact arms.
 * Each pose contains sculpted local bone quaternions [x, y, z, w] for thumb, index, middle, ring, pinky.
 * Eliminates splayed fists and generic claws across different weapon geometries.
 */

export interface FingerGripPose {
  [boneName: string]: [number, number, number, number];
}

/**
 * AK-47 Assault Rifle:
 * Right Hand: Firm pistol grip with trigger finger extended along the trigger guard.
 * Left Hand: Natural cupping grasp underneath the lower wooden handguard, thumb along the gas tube.
 */
export const AK_GRIP_RIGHT: FingerGripPose = {
  palm01R: [0.0042, -0.7724, -0.0896, 0.6287],
  f_index01R: [0.55, 0.05, -0.01, 0.83], // Poised on trigger
  f_index02R: [0.45, -0.01, 0.01, 0.89],
  f_index03R: [0.42, 0.0, 0.0, 0.91],
  thumb01R: [0.0619, -0.3948, -0.2959, 0.8676],
  thumb02R: [0.5574, 0.0415, 0.0194, 0.829],
  thumb03R: [0.4828, -0.0893, 0.0736, 0.868],
  palm02R: [-0.0338, -0.7304, -0.0702, 0.6786],
  f_middle01R: [0.7354, 0.0168, 0.0029, 0.6774],
  f_middle02R: [0.6254, 0.0111, -0.0029, 0.7802],
  f_middle03R: [0.6215, 0.0043, -0.0018, 0.7834],
  palm03R: [0.0079, 0.6967, -0.0787, 0.713],
  f_ring01R: [0.0189, -0.6785, 0.734, 0.0204],
  f_ring02R: [0.615, -0.0012, 0.0064, 0.7885],
  f_ring03R: [0.6485, 0.0325, -0.0219, 0.7602],
  palm04R: [-0.1256, -0.6614, 0.0393, 0.7384],
  f_pinky01R: [0.7284, -0.0087, 0.0124, 0.685],
  f_pinky02R: [0.6398, 0.0348, -0.0034, 0.7677],
  f_pinky03R: [0.5934, -0.0201, 0.0147, 0.8045],
};

export const AK_GRIP_LEFT: FingerGripPose = {
  palm01L: [0.01, 0.7703, 0.0982, 0.63],
  f_index01L: [0.6802, -0.0462, -0.0224, 0.731],
  f_index02L: [0.5167, 0.0206, -0.008, 0.855],
  f_index03L: [0.4921, 0.0033, -0.0044, 0.87],
  thumb01L: [0.0122, 0.414, 0.3093, 0.856],
  thumb02L: [0.4771, -0.0033, -0.0225, 0.878],
  thumb03L: [0.3923, 0.1114, -0.0314, 0.912],
  palm02L: [-0.033, 0.7301, 0.0713, 0.6788],
  f_middle01L: [0.7192, -0.0114, -0.0127, 0.694],
  f_middle02L: [0.5892, -0.0105, -0.0046, 0.807],
  f_middle03L: [0.5642, -0.0045, -0.0012, 0.825],
  palm03L: [0.0034, -0.6955, 0.0825, 0.7138],
  f_ring01L: [0.6922, 0.0871, -0.1575, 0.699],
  f_ring02L: [0.5841, 0.0049, -0.0043, 0.811],
  f_ring03L: [0.5698, -0.039, -0.0029, 0.82],
  palm04L: [-0.1291, 0.6619, -0.0428, 0.7372],
  f_pinky01L: [0.699, 0.0145, -0.0043, 0.714],
  f_pinky02L: [0.5883, -0.0295, -0.0188, 0.807],
  f_pinky03L: [0.541, 0.0249, 0.0008, 0.84],
};

/**
 * Tactical Pistol:
 * Right Hand: Tight cylindrical wrap around compact 9mm grip frame, index finger straight along frame.
 * Left Hand: Modern two-handed thumbs-forward support cup. Left thumb points forward along slide,
 * fingers wrap over the right hand's knuckles for recoil stability.
 */
export const PISTOL_GRIP_RIGHT: FingerGripPose = {
  palm01R: [0.01, -0.75, -0.08, 0.65],
  f_index01R: [0.547, -0.311, 0.020, 0.777], // Extended forward along frame outside trigger guard
  f_index02R: [0.516, -0.008, 0.011, 0.857],
  f_index03R: [0.485, 0.0, 0.0, 0.874],
  thumb01R: [-0.051, -0.508, -0.057, 0.858], // Wrapped snugly against frame flat below slide
  thumb02R: [0.451, 0.020, 0.010, 0.892],
  thumb03R: [0.590, -0.045, 0.029, 0.805],
  palm02R: [-0.03, -0.72, -0.06, 0.69],
  f_middle01R: [0.76, 0.02, 0.0, 0.65], // Tightly curled around pistol grip
  f_middle02R: [0.68, 0.01, 0.0, 0.73],
  f_middle03R: [0.65, 0.0, 0.0, 0.76],
  palm03R: [0.01, 0.68, -0.07, 0.73],
  f_ring01R: [0.02, -0.66, 0.74, 0.02],
  f_ring02R: [0.66, 0.0, 0.0, 0.75],
  f_ring03R: [0.68, 0.02, -0.01, 0.73],
  palm04R: [-0.12, -0.65, 0.03, 0.75],
  f_pinky01R: [0.75, -0.01, 0.01, 0.66],
  f_pinky02R: [0.67, 0.02, 0.0, 0.74],
  f_pinky03R: [0.62, -0.01, 0.01, 0.78],
};

export const PISTOL_GRIP_LEFT: FingerGripPose = {
  // Thumbs-forward tactical cup wrap: fingers wrap around front of right hand
  palm01L: [0.02, 0.72, 0.08, 0.68],
  f_index01L: [0.78, -0.03, -0.02, 0.62], // Wrapping over right middle finger / trigger guard
  f_index02L: [0.72, 0.01, -0.01, 0.69],
  f_index03L: [0.65, 0.0, 0.0, 0.76],
  thumb01L: [-0.145, 0.737, -0.136, 0.646], // Thumbs-forward pointing down the slide flat with safe clearance
  thumb02L: [0.149, 0.0, 0.0, 0.989],
  thumb03L: [0.149, 0.0, 0.0, 0.989],
  palm02L: [-0.02, 0.71, 0.06, 0.7],
  f_middle01L: [0.75, -0.01, -0.01, 0.66],
  f_middle02L: [0.70, -0.01, 0.0, 0.71],
  f_middle03L: [0.65, 0.0, 0.0, 0.76],
  palm03L: [0.01, -0.68, 0.07, 0.73],
  f_ring01L: [0.02, -0.72, 0.69, 0.02], // Inverted bone axis corrected (2.01 mm contact)
  f_ring02L: [0.68, 0.0, 0.0, 0.73],
  f_ring03L: [0.62, -0.02, 0.0, 0.78],
  palm04L: [-0.11, 0.65, -0.03, 0.75],
  f_pinky01L: [0.70, 0.01, 0.0, 0.71],
  f_pinky02L: [0.66, -0.02, -0.01, 0.75],
  f_pinky03L: [0.58, 0.02, 0.0, 0.81],
};

/**
 * Rapid SMG:
 * Right Hand: Firm pistol grip.
 * Left Hand: Wrapped around the forward receiver / magazine well foregrip.
 */
export const SMG_GRIP_RIGHT: FingerGripPose = { ...AK_GRIP_RIGHT };

export const SMG_GRIP_LEFT: FingerGripPose = {
  palm01L: [0.01, 0.75, 0.09, 0.65],
  f_index01L: [0.72, -0.04, -0.02, 0.69],
  f_index02L: [0.62, 0.02, -0.01, 0.78],
  f_index03L: [0.56, 0.0, 0.0, 0.83],
  thumb01L: [0.01, 0.38, 0.28, 0.88],
  thumb02L: [0.52, 0.0, -0.02, 0.85],
  thumb03L: [0.42, 0.09, -0.02, 0.9],
  palm02L: [-0.03, 0.72, 0.07, 0.69],
  f_middle01L: [0.74, -0.01, -0.01, 0.67],
  f_middle02L: [0.65, -0.01, 0.0, 0.76],
  f_middle03L: [0.6, 0.0, 0.0, 0.8],
  palm03L: [0.0, -0.69, 0.08, 0.72],
  f_ring01L: [0.71, 0.07, -0.14, 0.68],
  f_ring02L: [0.64, 0.0, 0.0, 0.77],
  f_ring03L: [0.62, -0.03, 0.0, 0.78],
  palm04L: [-0.12, 0.66, -0.04, 0.74],
  f_pinky01L: [0.72, 0.01, 0.0, 0.69],
  f_pinky02L: [0.64, -0.02, -0.01, 0.77],
  f_pinky03L: [0.59, 0.02, 0.0, 0.81],
};

/**
 * Combat Shotgun:
 * Right Hand: Curved wrap around traditional wooden/synthetic stock wrist.
 * Left Hand: Full cylindrical wrap around the grooved pump slide.
 */
export const SHOTGUN_GRIP_RIGHT: FingerGripPose = {
  palm01R: [0.01, -0.76, -0.08, 0.64],
  f_index01R: [0.58, 0.04, -0.01, 0.81],
  f_index02R: [0.5, -0.01, 0.01, 0.86],
  f_index03R: [0.45, 0.0, 0.0, 0.89],
  thumb01R: [0.07, -0.38, -0.28, 0.88],
  thumb02R: [0.52, 0.03, 0.01, 0.85],
  thumb03R: [0.45, -0.07, 0.06, 0.89],
  palm02R: [-0.03, -0.73, -0.07, 0.68],
  f_middle01R: [0.72, 0.01, 0.0, 0.69],
  f_middle02R: [0.64, 0.01, 0.0, 0.77],
  f_middle03R: [0.61, 0.0, 0.0, 0.79],
  palm03R: [0.01, 0.69, -0.08, 0.72],
  f_ring01R: [0.02, -0.67, 0.73, 0.02],
  f_ring02R: [0.63, 0.0, 0.0, 0.78],
  f_ring03R: [0.64, 0.02, -0.01, 0.77],
  palm04R: [-0.12, -0.66, 0.04, 0.74],
  f_pinky01R: [0.71, -0.01, 0.01, 0.7],
  f_pinky02R: [0.63, 0.03, 0.0, 0.78],
  f_pinky03R: [0.58, -0.02, 0.01, 0.81],
};

export const SHOTGUN_GRIP_LEFT: FingerGripPose = {
  palm01L: [0.01, 0.78, 0.09, 0.62],
  f_index01L: [0.74, -0.04, -0.02, 0.67],
  f_index02L: [0.65, 0.02, -0.01, 0.76],
  f_index03L: [0.58, 0.0, 0.0, 0.81],
  thumb01L: [0.01, 0.44, 0.32, 0.84],
  thumb02L: [0.56, 0.0, -0.02, 0.83],
  thumb03L: [0.45, 0.1, -0.02, 0.89],
  palm02L: [-0.03, 0.74, 0.07, 0.67],
  f_middle01L: [0.76, -0.01, -0.01, 0.65],
  f_middle02L: [0.68, -0.01, 0.0, 0.73],
  f_middle03L: [0.62, 0.0, 0.0, 0.78],
  palm03L: [0.0, -0.7, 0.08, 0.71],
  f_ring01L: [0.74, 0.07, -0.15, 0.65],
  f_ring02L: [0.67, 0.0, 0.0, 0.74],
  f_ring03L: [0.63, -0.03, 0.0, 0.77],
  palm04L: [-0.13, 0.67, -0.04, 0.73],
  f_pinky01L: [0.74, 0.01, 0.0, 0.67],
  f_pinky02L: [0.66, -0.02, -0.01, 0.75],
  f_pinky03L: [0.6, 0.02, 0.0, 0.8],
};

/**
 * Precision Sniper:
 * Right Hand: Curved wrap around bolt-action stock wrist.
 * Left Hand: Open cradle underneath wide forward wooden forestock.
 */
export const SNIPER_GRIP_RIGHT: FingerGripPose = { ...SHOTGUN_GRIP_RIGHT };

export const SNIPER_GRIP_LEFT: FingerGripPose = {
  // Open palm cradling underneath stock
  palm01L: [0.01, 0.72, 0.07, 0.69],
  f_index01L: [0.45, -0.02, -0.01, 0.89], // Gently supporting
  f_index02L: [0.42, 0.01, 0.0, 0.91],
  f_index03L: [0.38, 0.0, 0.0, 0.92],
  thumb01L: [0.01, 0.32, 0.22, 0.92], // Thumb along left side of forestock
  thumb02L: [0.38, 0.0, -0.01, 0.92],
  thumb03L: [0.32, 0.08, -0.01, 0.94],
  palm02L: [-0.02, 0.7, 0.05, 0.71],
  f_middle01L: [0.48, -0.01, 0.0, 0.88],
  f_middle02L: [0.44, 0.0, 0.0, 0.9],
  f_middle03L: [0.4, 0.0, 0.0, 0.92],
  palm03L: [0.0, -0.68, 0.06, 0.73],
  f_ring01L: [0.5, 0.04, -0.1, 0.86],
  f_ring02L: [0.46, 0.0, 0.0, 0.89],
  f_ring03L: [0.42, -0.02, 0.0, 0.91],
  palm04L: [-0.11, 0.64, -0.03, 0.76],
  f_pinky01L: [0.52, 0.01, 0.0, 0.85],
  f_pinky02L: [0.47, -0.01, 0.0, 0.88],
  f_pinky03L: [0.43, 0.01, 0.0, 0.9],
};

/**
 * Reload: Magazine Pinch / Grasp Pose for Left Hand.
 * Thumb and index finger pinch the flat box magazine sides.
 */
export const MAGAZINE_GRASP_LEFT: FingerGripPose = {
  palm01L: [0.01, 0.74, 0.08, 0.67],
  f_index01L: [0.52, -0.03, -0.01, 0.85],
  f_index02L: [0.58, 0.01, 0.0, 0.81],
  f_index03L: [0.54, 0.0, 0.0, 0.84],
  thumb01L: [0.03, 0.35, 0.25, 0.9], // Opposed thumb pinching mag
  thumb02L: [0.58, -0.01, -0.02, 0.81],
  thumb03L: [0.52, 0.08, -0.02, 0.85],
  palm02L: [-0.02, 0.71, 0.06, 0.7],
  f_middle01L: [0.65, -0.01, 0.0, 0.76],
  f_middle02L: [0.68, 0.0, 0.0, 0.73],
  f_middle03L: [0.62, 0.0, 0.0, 0.78],
  palm03L: [0.01, -0.68, 0.07, 0.73],
  f_ring01L: [0.68, 0.05, -0.12, 0.72],
  f_ring02L: [0.7, 0.0, 0.0, 0.71],
  f_ring03L: [0.65, -0.02, 0.0, 0.76],
  palm04L: [-0.11, 0.65, -0.03, 0.75],
  f_pinky01L: [0.7, 0.01, 0.0, 0.71],
  f_pinky02L: [0.68, -0.01, 0.0, 0.73],
  f_pinky03L: [0.62, 0.01, 0.0, 0.78],
};

/**
 * Reload: Bolt Action Hook Pose (Index finger curved around bolt knob).
 */
export const BOLT_HOOK_RIGHT: FingerGripPose = {
  palm01R: [0.01, -0.75, -0.08, 0.65],
  f_index01R: [0.72, 0.04, -0.01, 0.69], // Hooked around bolt knob
  f_index02R: [0.68, -0.01, 0.01, 0.73],
  f_index03R: [0.62, 0.0, 0.0, 0.78],
  thumb01R: [0.07, -0.32, -0.22, 0.92], // Thumb braced against receiver
  thumb02R: [0.42, 0.02, 0.01, 0.91],
  thumb03R: [0.38, -0.06, 0.05, 0.92],
  palm02R: [-0.03, -0.72, -0.06, 0.69],
  f_middle01R: [0.62, 0.01, 0.0, 0.78],
  f_middle02R: [0.58, 0.01, 0.0, 0.81],
  f_middle03R: [0.54, 0.0, 0.0, 0.84],
  palm03R: [0.01, 0.68, -0.07, 0.73],
  f_ring01R: [0.02, -0.66, 0.74, 0.02],
  f_ring02R: [0.58, 0.0, 0.0, 0.81],
  f_ring03R: [0.55, 0.02, -0.01, 0.83],
  palm04R: [-0.12, -0.65, 0.03, 0.75],
  f_pinky01R: [0.65, -0.01, 0.01, 0.76],
  f_pinky02R: [0.58, 0.02, 0.0, 0.81],
  f_pinky03R: [0.52, -0.01, 0.01, 0.85],
};
