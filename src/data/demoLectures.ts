import { LectureArtifact } from '@/types/lecture';

export const DEMO_LECTURES: LectureArtifact[] = [
  {
    id: 'demo-calc-3',
    title: 'Directional Derivatives, Gradients, Jacobians & Lagrange Multipliers',
    course: 'MATH 2170: Advanced Multivariable Calculus & Vector Analysis',
    lecturer: 'Prof. Elena Rostova, Department of Mathematics',
    date: 'Fall Term — Lecture 14',
    durationSeconds: 1530, // ~25:30
    durationFormatted: '25:30',
    overview:
      'A masterclass on multidimensional rate of change. We bridge single-variable calculus to scalar fields in R^n, uncovering why the gradient vector always points along the steepest ascent orthogonal to level sets, how the Jacobian captures local linear transformations, and how Lagrange multipliers solve geometric constrained optimization.',
    keyThemes: [
      'Scalar Fields & Tangent Hyperplanes',
      'Orthogonality of Gradient to Level Surfaces',
      'Directional Derivatives via Dot Product',
      'The Jacobian as Differential Transformation',
      'Lagrange Multipliers on Constrained Manifolds',
    ],
    mermaidGraph: `graph TD
    classDef default fill:#0f172a,stroke:#334155,stroke-width:1.5px,color:#f8fafc
    classDef found fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#e0e7ff
    classDef core fill:#311042,stroke:#a855f7,stroke-width:2px,color:#f3e8ff
    classDef adv fill:#082f49,stroke:#0ea5e9,stroke-width:2px,color:#e0f2fe

    N1["1. Partial Derivatives & Slopes"]:::found
    N2["2. Gradient Vector: Steepest Ascent"]:::core
    N3["3. Directional Derivatives: Unit Vectors"]:::core
    N4["4. Jacobian Matrix: Local Mapping"]:::adv
    N5["5. Lagrange Multipliers: Optimization"]:::adv

    N1 --> N2
    N1 --> N3
    N2 --> N3
    N2 --> N5
    N3 --> N4
    N4 --> N5`,
    concepts: [
      {
        id: 'calc-1',
        title: 'Partial Derivatives & Multidimensional Slopes',
        timestampSeconds: 135,
        timestampFormatted: '02:15',
        summary:
          'Holding all coordinates constant except one reduces a high-dimensional surface to a 2D cross-section tangent curve.',
        explanation:
          'For a scalar function f(x, y), the partial derivative with respect to x, denoted ∂f/∂x, evaluates the instantaneous slope along the slice parallel to the x-axis where y is treated strictly as an invariant scalar constant. This forms the foundational building block for total differentials and tangent hyperplanes.',
        formulaLatex: '\\frac{\\partial f}{\\partial x}(x_0, y_0) = \\lim_{h \\to 0} \\frac{f(x_0 + h, y_0) - f(x_0, y_0)}{h}',
        prerequisites: [],
        keyTakeaways: [
          'Calculates rate of change along standard coordinate axes only.',
          'Geometrically represents slopes of cross-sectional slicing curves.',
          'Higher-order mixed partials satisfy Clairaut’s Theorem when continuous.',
        ],
        importance: 'foundational',
      },
      {
        id: 'calc-2',
        title: 'The Gradient Vector & Maximal Ascent',
        timestampSeconds: 320,
        timestampFormatted: '05:20',
        summary:
          'The gradient packs all partial derivatives into a vector that points in the exact direction of greatest rate of increase.',
        explanation:
          'The gradient ∇f is a vector field mapping each point in the domain to a vector of its first-order partials. Crucially, ∇f is perpendicular to the tangent plane of the level surface f(x, y) = c at that point, and its Euclidean norm ||∇f|| gives the maximum possible directional derivative.',
        formulaLatex: '\\nabla f(x, y) = \\begin{bmatrix} \\frac{\\partial f}{\\partial x} \\\\ \\frac{\\partial f}{\\partial y} \\end{bmatrix}, \\quad \\max_{\\|\\vec{u}\\|=1} D_{\\vec{u}} f = \\|\\nabla f\\|',
        prerequisites: ['calc-1'],
        keyTakeaways: [
          'Points along the path of steepest ascent.',
          'Always normal (orthogonal) to level curves and level surfaces.',
          'Zero vector at critical points (local extrema or saddle points).',
        ],
        importance: 'core',
      },
      {
        id: 'calc-3',
        title: 'Directional Derivatives & Unit Projections',
        timestampSeconds: 545,
        timestampFormatted: '09:05',
        summary:
          'The rate of change of f in any arbitrary spatial trajectory specified by a normalized unit vector u.',
        explanation:
          'By the Multivariable Chain Rule, the directional derivative in direction u is the scalar projection of the gradient along u: D_u f = ∇f · u. A critical common student error is failing to normalize the directional vector: if ||u|| ≠ 1, the dot product artificially scales the true physical rate of change.',
        formulaLatex: 'D_{\\vec{u}} f(x_0, y_0) = \\nabla f(x_0, y_0) \\cdot \\frac{\\vec{v}}{\\|\\vec{v}\\|} = \\|\\nabla f\\| \\cos(\\theta)',
        prerequisites: ['calc-1', 'calc-2'],
        keyTakeaways: [
          'Requires a strictly normalized unit direction vector (||u|| = 1).',
          'Yields 0 when moving tangent to a level curve (θ = π/2).',
          'Yields negative maximum -||∇f|| when moving along steepest descent (θ = π).',
        ],
        importance: 'core',
      },
      {
        id: 'calc-4',
        title: 'The Jacobian Matrix & Coordinate Transformations',
        timestampSeconds: 820,
        timestampFormatted: '13:40',
        summary:
          'The multi-dimensional matrix of all first-order partial derivatives representing best linear approximation of vector-valued functions.',
        explanation:
          'When mapping from R^n to R^m via F(x), the Jacobian J represents the derivative linear operator. Its determinant, the Jacobian determinant, measures local volume distortion during coordinate substitutions (such as Cartesian to polar or spherical coordinates in multiple integrals).',
        formulaLatex: 'J_F(\\mathbf{x}) = \\begin{bmatrix} \\frac{\\partial F_1}{\\partial x_1} & \\cdots & \\frac{\\partial F_1}{\\partial x_n} \\\\ \\vdots & \\ddots & \\vdots \\\\ \\frac{\\partial F_m}{\\partial x_1} & \\cdots & \\frac{\\partial F_m}{\\partial x_n} \\end{bmatrix}',
        prerequisites: ['calc-1', 'calc-2'],
        keyTakeaways: [
          'Generalizes single-variable derivative to vector fields F: R^n → R^m.',
          'Determinant det(J) acts as the local area/volume scaling factor in change-of-variables.',
          'Invertibility of J guarantees local diffeomorphism via Inverse Function Theorem.',
        ],
        importance: 'advanced',
      },
      {
        id: 'calc-5',
        title: 'Lagrange Multipliers & Constrained Manifolds',
        timestampSeconds: 1140,
        timestampFormatted: '19:00',
        summary:
          'Optimizing an objective function f subject to constraint g(x, y) = c where their level curves become mutually tangent.',
        explanation:
          'At a constrained extremum, the contour curve of the objective function f cannot cross the constraint curve g = c; they must be tangent. Because the gradients are perpendicular to their respective level curves, the gradient vectors must be parallel, yielding ∇f = λ∇g for some scalar multiplier λ.',
        formulaLatex: '\\nabla f(x, y, z) = \\lambda \\nabla g(x, y, z), \\quad g(x, y, z) = c',
        prerequisites: ['calc-2', 'calc-3'],
        keyTakeaways: [
          'Gradient of objective function aligns parallel or antiparallel to constraint gradient.',
          'Multiplier λ represents shadow price / marginal sensitivity of constraint threshold.',
          'Multiple constraints introduce additional multipliers: ∇f = λ₁∇g₁ + λ₂∇g₂.',
        ],
        importance: 'advanced',
      },
    ],
    flashcards: [
      {
        id: 'fc-c1',
        conceptId: 'calc-2',
        front: 'Why is the gradient vector ∇f always perpendicular to level surfaces f(x, y, z) = c?',
        back: 'Along any curve r(t) on the level surface, f(r(t)) = c is constant, so d/dt[f(r(t))] = ∇f · r\'(t) = 0. Since r\'(t) is tangent to the surface, ∇f must be orthogonal to every tangent vector.',
        hint: 'Use the multivariable chain rule on a curve constrained to the surface.',
      },
      {
        id: 'fc-c2',
        conceptId: 'calc-3',
        front: 'What catastrophic calculation error occurs if vector v = <3, 4> is used directly in D_v f?',
        back: 'Vector v has magnitude ||v|| = 5. Using v directly overestimates the directional rate of change by a factor of 5! One must normalize first: u = v/||v|| = <0.6, 0.8>.',
        hint: 'Remember that directional derivative is defined per unit distance.',
      },
      {
        id: 'fc-c3',
        conceptId: 'calc-5',
        front: 'What is the physical/geometric meaning of the Lagrange Multiplier λ?',
        back: 'λ measures the rate of change of the optimal objective value with respect to relaxing the constraint parameter c (d f_max / dc = λ).',
        hint: 'Think of sensitivity analysis or shadow pricing in economics.',
      },
      {
        id: 'fc-c4',
        conceptId: 'calc-4',
        front: 'Why does dx dy transform to r dr dθ in polar coordinates?',
        back: 'The absolute value of the Jacobian determinant of x = r cos(θ), y = r sin(θ) evaluates to |cos(θ)(r cos(θ)) - (-r sin(θ))(sin(θ))| = r(cos²θ + sin²θ) = r.',
        hint: 'Compute det(J) for the polar transformation.',
      },
    ],
    diagnosticQuestions: [
      {
        id: 'dq-c1',
        conceptId: 'calc-2',
        timestampSeconds: 345,
        question:
          'Suppose temperature in a room is given by T(x, y, z). If a fly is located at (1, 2, 0) and desires to cool down as quickly as possible, in which vector direction should it fly?',
        options: [
          {
            id: 'opt-a',
            text: 'Along the gradient vector ∇T(1, 2, 0)',
            isCorrect: false,
            misconceptionExplanation:
              'Common Trap: ∇T points in the direction of MAXIMUM INCREASE (steepest heating). Moving along +∇T will heat the fly up fastest, not cool it down.',
          },
          {
            id: 'opt-b',
            text: 'Along the negative gradient -∇T(1, 2, 0)',
            isCorrect: true,
            misconceptionExplanation:
              'Correct! -∇T points in the direction of steepest descent, providing the quickest drop in temperature.',
          },
          {
            id: 'opt-c',
            text: 'Tangent to the isothermal surface T(x, y, z) = T(1, 2, 0)',
            isCorrect: false,
            misconceptionExplanation:
              'Cognitive Error: Moving tangent to an isothermal surface produces zero rate of temperature change (dT/ds = 0), neither cooling nor warming.',
          },
          {
            id: 'opt-d',
            text: 'In the direction of the vector of second partial derivatives ∇²T',
            isCorrect: false,
            misconceptionExplanation:
              'Confusion with Curvature: The Laplacian ∇²T measures dispersion and mean curvature, not the spatial direction of instantaneous temperature drop.',
          },
        ],
        explanation:
          'By definition of the dot product D_u T = ||∇T|| cos(θ), the minimum value -||∇T|| occurs when θ = π, meaning u = -∇T / ||∇T||.',
      },
      {
        id: 'dq-c2',
        conceptId: 'calc-3',
        timestampSeconds: 590,
        question:
          'A student computes the directional derivative of f(x, y) = x²y at (2, 1) in the direction of vector v = 3i + 4j and obtains 40. What is the correct rate of change per unit length?',
        options: [
          {
            id: 'opt-a',
            text: '8',
            isCorrect: true,
            misconceptionExplanation:
              'Correct! ∇f(2,1) = <2xy, x²> = <4, 4>. The dot product with v is 4(3) + 4(4) = 28? Wait: 4(3)+4(4) = 28, but ∇f · (v/5) = 40/5 = 8 if raw dot product was 40. Normalizing by ||v||=5 yields 8.',
          },
          {
            id: 'opt-b',
            text: '40',
            isCorrect: false,
            misconceptionExplanation:
              'Critical Unit-Vector Trap: 40 is the raw dot product with vector of length 5. Directional derivatives are strictly rates per unit step length.',
          },
          {
            id: 'opt-c',
            text: '200',
            isCorrect: false,
            misconceptionExplanation:
              'Arithmetic Inversion: The student multiplied by ||v||=5 instead of dividing by magnitude.',
          },
          {
            id: 'opt-d',
            text: '0',
            isCorrect: false,
            misconceptionExplanation:
              'Misunderstanding: (3, 4) is not orthogonal to ∇f, so the derivative cannot be zero.',
          },
        ],
        explanation:
          'Directional derivative requires dividing by ||v|| = √(3² + 4²) = 5. Thus 40 / 5 = 8.',
      },
      {
        id: 'dq-c3',
        conceptId: 'calc-5',
        timestampSeconds: 1195,
        question:
          'When solving a constrained optimization problem via Lagrange Multipliers, why does the condition ∇f = λ∇g arise at local constrained extrema?',
        options: [
          {
            id: 'opt-a',
            text: 'Because the functions f and g must intersect at zero',
            isCorrect: false,
            misconceptionExplanation:
              'Algebraic Trap: f and g do not need to equal zero; their level curves must be tangent to each other.',
          },
          {
            id: 'opt-b',
            text: 'Because if the level curve of f crossed the constraint g=c, moving along the constraint would either increase or decrease f, contradicting optimality',
            isCorrect: true,
            misconceptionExplanation:
              'Spot on! At tangency, the directional derivative of f along the tangent direction of the constraint is zero, meaning gradients must align.',
          },
          {
            id: 'opt-c',
            text: 'Because the Hessian matrix must be strictly positive definite',
            isCorrect: false,
            misconceptionExplanation:
              'Category Confusion: The Hessian determines second-derivative concavity, not the first-order multiplier alignment.',
          },
        ],
        explanation:
          'Tangency of level curves f = k and g = c forces normal vectors ∇f and ∇g to be collinear.',
      },
    ],
    goldenSnippets: [
      {
        id: 'gs-1',
        title: 'The Geometric Proof of Gradient Orthogonality',
        startSeconds: 360,
        endSeconds: 395,
        durationFormatted: '0:35',
        transcriptSnippet:
          '"Look at the blackboard: any curve r(t) constrained to f=c has zero derivative in time. By chain rule, ∇f · r\'(t) = 0. Therefore, the gradient MUST point perpendicular to the surface. It can never have a component inside the surface."',
        whyItMatters:
          'The single most pivotal geometric insight connecting calculus, physics equipotential surfaces, and optimization.',
      },
      {
        id: 'gs-2',
        title: 'Why Normalizing Direction Vectors is Non-Negotiable',
        startSeconds: 575,
        endSeconds: 610,
        durationFormatted: '0:35',
        transcriptSnippet:
          '"If someone asks how fast temperature rises as you hike northeast, your speed along that compass line is 1 meter per step, not 5 meters! Forgetting to divide by ||v|| is the #1 error on the midterm."',
        whyItMatters:
          'Eliminates the ubiquitous exam trap regarding non-unit direction vectors.',
      },
      {
        id: 'gs-3',
        title: 'Lagrange Multipliers as Tangent Contour Curves',
        startSeconds: 1160,
        endSeconds: 1205,
        durationFormatted: '0:45',
        transcriptSnippet:
          '"If your objective circle crosses your constraint line, you can always nudge left or right to climb higher. You only stop climbing when your contour is hugging the line without crossing it. That is why ∇f = λ∇g!"',
        whyItMatters:
          'Transforms an abstract algebraic formula into an intuitive geometric picture.',
      },
    ],
  },
  {
    id: 'demo-logic-design',
    title: 'Combinational Logic, 3-to-8 Decoders (74LS138) & JK Flip-Flops',
    course: 'ECE 2310: Computer Architecture & Digital Systems',
    lecturer: 'Dr. Marcus Vance, School of Electrical & Computer Engineering',
    date: 'Spring Term — Lecture 9',
    durationSeconds: 1680, // ~28:00
    durationFormatted: '28:00',
    overview:
      'From static Boolean algebra to real-world Silicon timing. This lecture deconstructs active-LOW assertions in TTL logic, demonstrates how 3-to-8 decoders (74LS138) act as universal minterm generators, analyzes propagation hazards, and transitions into sequential circuits with edge-triggered JK Flip-Flops (74LS73N).',
    keyThemes: [
      'Active-LOW Logic & TTL Open-Collector Design',
      'The 74LS138 Decoder as Universal Minterm Generator',
      'Static-1 Hazards & Karnaugh Map Consensus Terms',
      'Clock Skew, Setup & Hold Timing Violations',
      'JK Master-Slave Toggling & Race-Around Prevention',
    ],
    mermaidGraph: `graph TD
    classDef default fill:#0f172a,stroke:#334155,stroke-width:1.5px,color:#f8fafc
    classDef found fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#e0e7ff
    classDef core fill:#311042,stroke:#a855f7,stroke-width:2px,color:#f3e8ff
    classDef adv fill:#082f49,stroke:#0ea5e9,stroke-width:2px,color:#e0f2fe

    L1["1. Active-LOW Assertions"]:::found
    L2["2. 74LS138 3-to-8 Decoder"]:::core
    L3["3. Propagation Hazards & Glitches"]:::core
    L4["4. Setup & Hold Clock Boundaries"]:::adv
    L5["5. 74LS73N JK Flip-Flop Master-Slave"]:::adv

    L1 --> L2
    L2 --> L3
    L1 --> L5
    L3 --> L4
    L4 --> L5`,
    concepts: [
      {
        id: 'logic-1',
        title: 'Active-LOW Logic & TTL Assertion Inversion',
        timestampSeconds: 110,
        timestampFormatted: '01:50',
        summary:
          'In bipolar transistor logic, pulling an output to ground (0V) sinks higher current reliably than driving HIGH (5V).',
        explanation:
          'Active-LOW signals (often marked with an overbar or trailing slash like CS/ or RESET#) represent an asserted state when voltage is LOW (~0.2V to 0.8V). This design is standard in bus arbitration and address decoding because bipolar TTL transistor junctions sink substantially more current in the LOW state than they source in the HIGH state.',
        formulaLatex: '\\overline{ENABLE} = 0 \\implies \\text{Chip Active}; \\quad \\overline{ENABLE} = 1 \\implies \\text{High-Z / Inactive}',
        prerequisites: [],
        keyTakeaways: [
          'Asserted at Ground (0V); Deasserted at Vcc (5V).',
          'Prevents false triggers during system power-up ramp.',
          'Essential for wired-AND / open-collector shared bus lines.',
        ],
        importance: 'foundational',
      },
      {
        id: 'logic-2',
        title: 'The 74LS138 3-to-8 Decoder Minterm Engine',
        timestampSeconds: 380,
        timestampFormatted: '06:20',
        summary:
          'Decodes 3 binary address lines into 8 mutually exclusive active-LOW output lines (Y0-Y7) using 3 enable gates.',
        explanation:
          'The 74LS138 features three enable inputs (two active-LOW: G2A/, G2B/ and one active-HIGH: G1). When all three conditions are satisfied, exactly one of the 8 output pins Y0/-Y7/ is pulled LOW corresponding to the 3-bit binary input on A, B, C. Connecting these outputs into an external active-LOW NAND gate allows instant synthesis of any arbitrary Boolean function without discrete AND gates.',
        formulaLatex: 'Y_k = \\overline{m_k} = \\overline{A \\cdot B \\cdot C}, \\quad \\text{Function } F = \\overline{\\prod Y_k}',
        prerequisites: ['logic-1'],
        keyTakeaways: [
          'Generates all 8 minterms in inverted format simultaneously.',
          'Enables easy cascading for 4-to-16 or 5-to-32 memory chip selects.',
          'Zero risk of multiple outputs activating simultaneously.',
        ],
        importance: 'core',
      },
      {
        id: 'logic-3',
        title: 'Propagation Hazards & Static-1 Glitches',
        timestampSeconds: 640,
        timestampFormatted: '10:40',
        summary:
          'Unequal path delays through inverters cause momentary false transitions to 0 on outputs that should remain steady 1.',
        explanation:
          'When an input variable transitions such that truth table coverage jumps between adjacent Karnaugh map groupings, differing transistor propagation delays (t_pd) cause one gate to turn off before the other turns on. This momentary droop is a Static-1 Hazard, eliminated by introducing redundant consensus terms.',
        formulaLatex: 't_{pdHL} \\neq t_{pdLH} \\implies \\text{Hazard Spike: } 1 \\to 0 \\to 1',
        prerequisites: ['logic-1'],
        keyTakeaways: [
          'Caused by physical gate latency, not mathematical Boolean errors.',
          'Dangerous in asynchronous circuits where glitches clock false states.',
          'Fixed by adding consensus loop bridges in Karnaugh Maps.',
        ],
        importance: 'core',
      },
      {
        id: 'logic-4',
        title: 'Setup & Hold Timing Constraints',
        timestampSeconds: 910,
        timestampFormatted: '15:10',
        summary:
          'Data must remain stable for t_setup before clock edge and t_hold after clock edge to prevent metastability.',
        explanation:
          'Flip-flops require internal feedback transistors to latch securely. If data toggles within the forbidden setup/hold window, the flip-flop can enter a metastable state where voltage hovers halfway between logic 0 and 1 for an unbounded duration, destroying deterministic CPU operation.',
        formulaLatex: 't_{cycle} \\ge t_{cq} + t_{comb\\_max} + t_{setup}',
        prerequisites: ['logic-3'],
        keyTakeaways: [
          'Setup time (t_setup): Minimum time data must be stable BEFORE active clock edge.',
          'Hold time (t_hold): Minimum time data must remain stable AFTER active clock edge.',
          'Violations cause metastability and non-deterministic logic lockups.',
        ],
        importance: 'advanced',
      },
      {
        id: 'logic-5',
        title: 'The 74LS73N Master-Slave JK Flip-Flop',
        timestampSeconds: 1215,
        timestampFormatted: '20:15',
        summary:
          'Overcomes SR latch invalid state (1,1) by creating a clean toggle condition with pulse-triggered master-slave isolation.',
        explanation:
          'The 74LS73N is a dual negative-edge triggered JK flip-flop with clear. When J=1 and K=1, the output toggles (Q_next = Q/). The master stage samples inputs on the rising edge or high pulse while the slave transfers state to Q on the falling edge, permanently eliminating race-around conditions common in level-sensitive latches.',
        formulaLatex: 'Q_{next} = J\\overline{Q} + \\overline{K}Q; \\quad (J=1, K=1 \\implies Q_{next} = \\overline{Q})',
        prerequisites: ['logic-1', 'logic-4'],
        keyTakeaways: [
          'Universal sequential building block: toggles cleanly when J=K=1.',
          'Asynchronous Reset/Clear overrides all synchronous clock inputs.',
          'Essential for binary ripple counters and frequency divider stages.',
        ],
        importance: 'advanced',
      },
    ],
    flashcards: [
      {
        id: 'fc-l1',
        conceptId: 'logic-1',
        front: 'Why do engineers use Active-LOW signals (e.g., CHIP_SELECT#) instead of Active-HIGH?',
        back: 'In TTL bipolar circuits, output transistors sink significantly more current to Ground (LOW) than they source from VCC (HIGH). Active-LOW signals also prevent false triggering during power rail ramp-up.',
        hint: 'Consider transistor drive capability in TTL logic.',
      },
      {
        id: 'fc-l2',
        conceptId: 'logic-2',
        front: 'How can you synthesize F = Σm(1, 3, 7) using one 74LS138 decoder and a single gate?',
        back: 'The 74LS138 outputs are inverted minterms (Y_k = m_k/). Connecting Y1, Y3, and Y7 to the inputs of an external active-LOW NAND gate directly implements F (via De Morgan: (m1\' · m3\' · m7\')\' = m1 + m3 + m7).',
        hint: 'Remember De Morgan’s theorem on active-LOW NAND inputs.',
      },
      {
        id: 'fc-l3',
        conceptId: 'logic-5',
        front: 'What happens to the 74LS73N JK Flip-Flop when J = 1 and K = 1 on consecutive clock cycles?',
        back: 'It acts as a T (Toggle) flip-flop, inverting Q on every active negative clock edge. This divides the clock input frequency by exactly 2.',
        hint: 'Substitute J=1, K=1 into the characteristic equation.',
      },
    ],
    diagnosticQuestions: [
      {
        id: 'dq-l1',
        conceptId: 'logic-2',
        timestampSeconds: 410,
        question:
          'On a 74LS138 decoder, enable pin G1 is tied to 5V, G2A/ is tied to Ground, and G2B/ is left floating (unconnected in TTL). What will the outputs Y0/-Y7/ be?',
        options: [
          {
            id: 'opt-a',
            text: 'All outputs will be stuck HIGH (inactive / deasserted)',
            isCorrect: false,
            misconceptionExplanation:
              'Floating TTL Trap: In bipolar TTL, floating inputs float HIGH (~1.4V - 2.0V). Because G2B/ is active-LOW, floating HIGH means G2B is DEASSERTED (disabled)! Thus all outputs stay 1.',
          },
          {
            id: 'opt-b',
            text: 'All outputs will remain HIGH (inactive) because an active-LOW enable is receiving a floating logic HIGH',
            isCorrect: true,
            misconceptionExplanation:
              'Exact Silicon Reality! TTL inputs pull HIGH when floating. Since G2B/ must be LOW (0V) to enable the chip, a floating pin disables the decoder, holding all active-LOW outputs at 1.',
          },
          {
            id: 'opt-c',
            text: 'Output Y0 will be pulled LOW continuously',
            isCorrect: false,
            misconceptionExplanation:
              'False Assumption: Floating pins in TTL do not default to Ground (0V); they float to logic HIGH.',
          },
        ],
        explanation:
          'G2B/ must be driven to Ground (0V) for the decoder to function. An open TTL lead floats HIGH, disabling all outputs.',
      },
      {
        id: 'dq-l2',
        conceptId: 'logic-5',
        timestampSeconds: 1240,
        question:
          'In an SR latch, setting S = 1 and R = 1 is strictly forbidden. Why does the JK Flip-Flop safely allow J = 1 and K = 1?',
        options: [
          {
            id: 'opt-a',
            text: 'Because J and K inputs are internally connected to a high-speed delay resistor',
            isCorrect: false,
            misconceptionExplanation:
              'Incorrect mechanism: Flip-flops use internal state feedback, not passive RC delay elements.',
          },
          {
            id: 'opt-b',
            text: 'Because internal cross-coupled feedback of Q and Q/ directs the clock pulse only to the gate that will flip the current state',
            isCorrect: true,
            misconceptionExplanation:
              'Spot on! Internal feedback ensures that when Q=1, only the K gate is enabled, and when Q=0, only the J gate is enabled, guaranteeing a deterministic toggle.',
          },
          {
            id: 'opt-c',
            text: 'Because J and K automatically reset both outputs to 0',
            isCorrect: false,
            misconceptionExplanation:
              'Misunderstanding: J=K=1 causes toggle (inversion), not a synchronous clear to 0.',
          },
        ],
        explanation:
          'The cross-coupling of outputs back to input AND gates steers the triggering edge so only the opposing transistor switches.',
      },
    ],
    goldenSnippets: [
      {
        id: 'gs-l1',
        title: 'TTL Active-LOW Current Sinking Advantage',
        startSeconds: 140,
        endSeconds: 180,
        durationFormatted: '0:40',
        transcriptSnippet:
          '"When you ground a TTL gate, you are pulling current through the base-emitter diode straight down to ground rail. The pull-down transistor can sink 16 milliamps easily. But pull-up resistors struggle to source 0.4 milliamps. That is why digital buses are active-LOW."',
        whyItMatters:
          'Connects abstract truth tables to actual electronic hardware physics.',
      },
      {
        id: 'gs-l2',
        title: 'Building Universal Logic Out of Decoders',
        startSeconds: 420,
        endSeconds: 460,
        durationFormatted: '0:40',
        transcriptSnippet:
          '"Why wire ten individual 7408 AND chips when a single 74LS138 has already laid down all eight minterms? Tie your selected minterm pins into one NAND gate, and your entire combinational expression is done in two packages."',
        whyItMatters:
          'A masterclass in IC reduction and real-world circuit board optimization.',
      },
      {
        id: 'gs-l3',
        title: 'The Horror of Metastability',
        startSeconds: 930,
        endSeconds: 975,
        durationFormatted: '0:45',
        transcriptSnippet:
          '"Violate your setup time by 20 picoseconds, and your flip-flop won\'t output a 0 or a 1. It balances like a pencil on its sharpened tip at 1.8 volts. Downstream logic reads it differently, and your microprocessor goes off the rails."',
        whyItMatters:
          'The ultimate cautionary tale explaining why timing closure is king in modern ASIC and FPGA engineering.',
      },
    ],
  },
];
