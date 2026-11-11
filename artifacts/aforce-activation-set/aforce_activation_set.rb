# ============================================================================
# AFORCE — Touring Activation Set v01  (SketchUp Desktop Ruby script)
# Super Bowl weekend LA (Feb 2027) + NBA All-Star weekend Phoenix
#
# STATUS: Ran without errors in SketchUp (founder report, 2026-10-22).
# Scenes have not yet been visually reviewed against the brief; check each
# scene tab and adjust the CONFIG constants or placements as needed.
#
# HOW TO RUN (SketchUp 2021 or newer, Mac or Windows)
#   1. Open SketchUp with any model (a new empty model is fine).
#   2. Window > Ruby Console.
#   3. Paste this line into the console and press Enter:
#        load "/Users/brandonburrell/AForce-Command/artifacts/aforce-activation-set/aforce_activation_set.rb"
#      (Windows: use forward slashes in the path, e.g. "C:/.../aforce_activation_set.rb")
#   4. Save As… an .skp. Scenes 01–13 appear as tabs at the top of the view.
#
# SAFE TO RERUN: everything lands inside one new parent group named
# "AFORCE_ActivationSet_v01_<timestamp>". Nothing existing is deleted.
# The whole run is a single undoable operation (Edit > Undo once removes it).
# No external dependencies: SketchUp Ruby API only.
#
# UNITS: real-world scale. SketchUp's internal unit is inches; helpers below
# take feet. The model's display units are switched to Architectural (ft-in).
#
# CONVENTIONS
#   Origin = front-left corner of the full-size footprint at floor level.
#   +X right, +Y toward the back wall, +Z up. Guests enter from the front (y=0).
#   Full-size 20x20 config at x=0; compact 10x20 config at x=+40 ft;
#   exploded/packing layout at x=+80 ft. Scenes switch tag visibility so only
#   one configuration shows at a time.
#   Raw geometry stays Untagged; tags are applied only to groups/instances.
#
# EDITABLE PLACEHOLDERS: every text string, colour and module size is a
# constant in the CONFIG block below. "AFORCE" and "PERFORMANCE IS UNIVERSAL."
# are placeholder text. Artwork panels are flat grey faces labelled as
# placeholders. No logo artwork is generated: the N-N monogram here is a
# geometric stand-in for the supplied vector (see brand "Protect the signal").
# ============================================================================

module AFORCE_ActivationSet
  # ------------------------------------------------------------------ CONFIG
  BRAND_WORD      = "AFORCE"
  BRAND_LINE      = "PERFORMANCE IS UNIVERSAL."
  RITUAL          = ["PAUSE.", "HYDRATE.", "LOCK-IN.", "PERFORM."]
  RITUAL_SUBLINES = ["Create a moment of attention.",
                     "Make hydration part of your preparation.",
                     "Choose the next thing that matters.",
                     "Enter your moment prepared."]
  FONT            = "Arial"   # swap for "Inter" if installed; bold is used
  LOCK_IN_INDEX   = 2         # only this ritual word carries Signal Red

  # Colours (brand system v2.2.0 / Founder Library). Signal Red is the one
  # interchangeable accent: #C1281B is canonical; the Figma library lists
  # #E51E2A. Change SIGNAL_RED here to swap the whole model.
  SIGNAL_RED      = [193, 40, 27]
  AFORCE_BLACK    = [13, 13, 13]      # Cinematic Black
  CHARCOAL        = [34, 34, 34]      # matte charcoal set surfaces
  PAPER           = [233, 231, 225]   # warm white (Paper)
  BRUSHED_METAL   = [184, 184, 180]
  LED_WARM        = [255, 241, 220]
  FLAVOR_WATERMELON = [232, 69, 90]
  FLAVOR_SOURSOP    = [31, 163, 90]
  FLAVOR_BERRY      = [30, 91, 255]
  PLACEHOLDER_GREY  = [138, 138, 134]
  UTILITY_BLUE      = [30, 91, 255]

  # Module sizes (feet unless noted)
  FOOT_W, FOOT_D, MAX_H = 20.0, 20.0, 10.0
  COMPACT_W, COMPACT_D  = 20.0, 10.0
  PANEL_W, PANEL_H, PANEL_T, PANEL_REVEAL_IN = 4.0, 10.0, 0.5, 0.5
  COUNTER_MOD_W, COUNTER_D, COUNTER_H_IN = 5.0, 2.0, 42.0
  LEDGE_W_IN, LEDGE_D_IN, LEDGE_H_IN = 36.0, 12.0, 34.0
  TOTEM_W, TOTEM_H = 2.0, 7.0
  PLINTH_W_IN, PLINTH_H_IN = 16.0, 40.0
  BENCH_L, BENCH_D_IN, BENCH_H_IN = 6.0, 18.0, 18.0
  STOOL_DIA_IN, STOOL_H_IN = 16.0, 18.0
  WELCOME_W_IN, WELCOME_D_IN, WELCOME_H_IN = 30.0, 20.0, 34.0
  EYE_H_IN = 64.0   # guest-eye camera height (5'-4")

  CONFIG_X_COMPACT = 40.0
  CONFIG_X_PACKING = 80.0

  # ------------------------------------------------------------------ helpers
  def self.f(v) (v * 12.0) end                 # feet -> inches
  def self.pt(x, y, z) Geom::Point3d.new(f(x), f(y), f(z)) end
  def self.pti(x, y, z) Geom::Point3d.new(x, y, z) end   # inches

  def self.color(rgb) Sketchup::Color.new(rgb[0], rgb[1], rgb[2]) end

  def self.material(model, name, rgb, alpha = 1.0)
    m = model.materials[name] || model.materials.add(name)
    m.color = color(rgb)
    m.alpha = alpha
    m
  end

  def self.tag(model, name)
    model.layers[name] || model.layers.add(name)
  end

  # Box with min corner (x,y,z) in INCHES, size (w,d,h) in INCHES.
  def self.box(ents, x, y, z, w, d, h, mat = nil)
    face = ents.add_face(pti(x, y, z), pti(x + w, y, z), pti(x + w, y + d, z), pti(x, y + d, z))
    face.reverse! if face.normal.z < 0
    face.material = mat if mat
    face.back_material = mat if mat
    face.pushpull(h)
    face
  end

  # Vertical slab in the XZ plane at y (inches), extruded toward -Y (front).
  def self.front_slab(ents, x, y, z, w, h, depth, mat = nil)
    face = ents.add_face(pti(x, y, z), pti(x + w, y, z), pti(x + w, y, z + h), pti(x, y, z + h))
    face.reverse! if face.normal.y > 0
    face.material = mat if mat
    face.back_material = mat if mat
    face.pushpull(depth)
    face
  end

  def self.cylinder(ents, cx, cy, z, r, h, mat = nil, segs = 24)
    edges = ents.add_circle(pti(cx, cy, z), Z_AXIS, r, segs)
    face = ents.add_face(edges)
    face.reverse! if face.normal.z < 0
    face.material = mat if mat
    face.pushpull(h)
    face
  end

  def self.flat(ents, x, y, z, w, d, mat = nil)
    face = ents.add_face(pti(x, y, z), pti(x + w, y, z), pti(x + w, y + d, z), pti(x, y + d, z))
    face.reverse! if face.normal.z < 0
    face.material = mat if mat
    face.back_material = mat if mat
    face
  end

  def self.group(parent_ents, name, tag = nil, mat = nil)
    g = parent_ents.add_group
    g.name = name
    g.layer = tag if tag
    g.material = mat if mat
    g
  end

  def self.place(parent_ents, defn, x_in, y_in, z_in, tag, rot_deg = 0.0, name = nil)
    t = Geom::Transformation.translation(pti(x_in, y_in, z_in))
    t = t * Geom::Transformation.rotation(ORIGIN, Z_AXIS, rot_deg.degrees) if rot_deg != 0.0
    inst = parent_ents.add_instance(defn, t)
    inst.layer = tag
    inst.name = name if name
    inst
  end

  def self.note(ents, text, x_in, y_in, z_in, tag, lead = [0, -24, 18])
    t = ents.add_text(text, pti(x_in, y_in, z_in), Geom::Vector3d.new(lead[0], lead[1], lead[2]))
    t.layer = tag
    t
  end

  def self.dim(ents, p1, p2, offset, tag)
    d = ents.add_dimension_linear(p1, p2, offset)
    d.layer = tag
    d
  end

  # 3D text as a component definition, centred on x, baseline on z=0,
  # standing upright facing -Y (the front), letters proud toward -Y.
  def self.text_definition(model, name, string, height_in, extrusion_in, mat)
    defn = model.definitions.add(name)
    ents = defn.entities
    ents.add_3d_text(string, TextAlignCenter, FONT, true, false, height_in, 0.0, 0.0, true, extrusion_in)
    bb = defn.bounds
    shift = Geom::Transformation.translation(Geom::Vector3d.new(-(bb.min.x + bb.width / 2.0), -bb.min.y, -bb.min.z))
    rot = Geom::Transformation.rotation(ORIGIN, X_AXIS, 90.degrees)
    ents.transform_entities(rot * shift, ents.to_a)
    ents.each { |e| e.material = mat if e.respond_to?(:material=) }
    defn
  end

  # ------------------------------------------------------------------ definitions
  def self.build_definitions(model, m)
    d = {}

    # BW-01 wall panel: 4ft x 10ft x 6in, reveal built in (panel is 0.5in narrower)
    d[:panel] = model.definitions.add("AFORCE BW-01 Wall Panel 4x10")
    pe = d[:panel].entities
    box(pe, 0, 0, 0, f(PANEL_W) - PANEL_REVEAL_IN, f(PANEL_T), f(PANEL_H), m[:charcoal])
    # lighting hairline channel on the left edge of each panel (vertical reveal light)
    ch = group(pe, "LT-02 Vertical reveal channel", nil, m[:led])
    box(ch.entities, -PANEL_REVEAL_IN, 1.0, 6.0, PANEL_REVEAL_IN, 1.0, f(PANEL_H) - 12.0)

    # CTR-01 hydration counter module 5ft x 2ft x 42in
    d[:counter] = model.definitions.add("AFORCE CTR-01 Counter Module 5ft")
    ce = d[:counter].entities
    w, dd, h = f(COUNTER_MOD_W), f(COUNTER_D), COUNTER_H_IN
    fascia = group(ce, "Fascia (guest side)", nil, m[:black])
    front_slab(fascia.entities, 0, 1.0, 4.0, w, h - 1.5 - 4.0, 1.0)         # front skin above 4in toe
    box(fascia.entities, 0, 1.0, 0, w, 3.0, 4.0)                              # toe kick (recessed)
    sides = group(ce, "Carcass", nil, m[:charcoal])
    box(sides.entities, 0, 0, 0, 1.0, dd, h - 1.5)                            # left end
    box(sides.entities, w - 1.0, 0, 0, 1.0, dd, h - 1.5)                      # right end
    box(sides.entities, 1.0, 1.0, 0, w - 2.0, dd - 2.0, 1.0)                  # base deck
    box(sides.entities, 1.0, 1.0, 18.0, w - 2.0, dd - 2.0, 0.75)              # mid shelf
    top = group(ce, "Top (solid surface)", nil, m[:paper])
    box(top.entities, 0, 0, h - 1.5, w, dd, 1.5)
    rail = group(ce, "Brushed metal edge rail", nil, m[:metal])
    box(rail.entities, 0, 0, h - 2.0, w, 0.5, 2.0)
    # back bar riser with two backlit product niches
    riser = group(ce, "CTR-01a Back-bar riser (2 niches)", nil, m[:black])
    box(riser.entities, 0, dd - 8.0, h, w, 8.0, 14.0)
    [1.25, 3.75].each_with_index do |nx, i|
      niche = group(riser.entities, "Niche #{i + 1} (backlit)", nil, m[:led])
      box(niche.entities, f(nx) - 6.0, dd - 7.0, h + 1.0, 12.0, 1.0, 12.0)    # light panel
      # product placeholder: can 2.6in dia x 6in
      can = group(niche.entities, "Product placeholder (can)", nil, m[:metal])
      cylinder(can.entities, f(nx), dd - 4.0, h + 1.0, 1.3, 6.0)
    end
    # concealed storage shown from the staff side
    store = group(ce, "Concealed storage (staff side)", nil, m[:charcoal])
    bin = group(store.entities, "Waste bin allowance 15x15x24", nil, m[:utility])
    box(bin.entities, 2.0, 2.0, 1.0, 15.0, 15.0, 24.0)
    cups = group(store.entities, "Cups + supplies allowance", nil, m[:utility])
    box(cups.entities, 20.0, 2.0, 19.0, 36.0, 18.0, 14.0)
    product = group(store.entities, "Product case allowance", nil, m[:utility])
    box(product.entities, 20.0, 2.0, 1.0, 36.0, 18.0, 14.0)
    door = group(ce, "Staff access doors (ghosted)", nil, m[:ghost])
    front_slab(door.entities, 1.0, dd, 1.0, w - 2.0, h - 2.5, 0.75)           # rear doors, toward -Y means inset; fine

    # CTR-02 accessible service ledge 36 x 12 at 34in
    d[:ledge] = model.definitions.add("AFORCE CTR-02 Accessible Ledge 36in")
    le = d[:ledge].entities
    box(le, 0, 0, LEDGE_H_IN - 1.5, LEDGE_W_IN, LEDGE_D_IN, 1.5, m[:paper])
    box(le, 2.0, 2.0, 0, 2.0, 2.0, LEDGE_H_IN - 1.5, m[:metal])
    box(le, LEDGE_W_IN - 4.0, 2.0, 0, 2.0, 2.0, LEDGE_H_IN - 1.5, m[:metal])

    # ST-01 welcome / demo station 30 x 20 x 34 with tablet placeholder
    d[:welcome] = model.definitions.add("AFORCE ST-01 Welcome Demo Station")
    we = d[:welcome].entities
    box(we, 0, 0, 0, WELCOME_W_IN, WELCOME_D_IN, WELCOME_H_IN - 1.5, m[:charcoal])
    box(we, -1.0, -1.0, WELCOME_H_IN - 1.5, WELCOME_W_IN + 2.0, WELCOME_D_IN + 2.0, 1.5, m[:paper])
    tab = group(we, "Tablet placeholder 11x8 (angled stand)", nil, m[:black])
    box(tab.entities, WELCOME_W_IN / 2.0 - 5.5, 6.0, WELCOME_H_IN, 11.0, 2.0, 8.0)

    # ST-02 Lock-In totem 2ft x 2ft x 7ft, red vertical channel, tablet
    d[:totem] = model.definitions.add("AFORCE ST-02 Lock-In Totem")
    te = d[:totem].entities
    tw, th = f(TOTEM_W), f(TOTEM_H)
    box(te, 0, 0, 0, tw, tw, th, m[:charcoal])
    red = group(te, "LT-03 Signal Red channel (vertical)", nil, m[:red])
    box(red.entities, 2.0, -0.75, 6.0, 1.5, 0.75, th - 12.0)
    tab2 = group(te, "Tablet placeholder 11x8 (OS demo, portrait)", nil, m[:black])
    box(tab2.entities, tw / 2.0 - 4.0, -1.0, 40.0, 8.0, 1.0, 11.0)
    scr = group(te, "Screen placeholder (editable graphic)", nil, m[:placeholder])
    front_slab(scr.entities, 6.0, 0, 56.0, tw - 8.0, 20.0, 0.25)

    # ST-03 Perform exit blade 12in x 4in x 60in
    d[:blade] = model.definitions.add("AFORCE ST-03 Perform Exit Blade")
    be = d[:blade].entities
    box(be, 0, 0, 0, 12.0, 4.0, 60.0, m[:charcoal])
    box(be, 12.0, 1.0, 6.0, 0.5, 2.0, 50.0, m[:led])

    # DP-01 product display plinth 16 x 16 x 40 with product placeholders
    d[:plinth] = model.definitions.add("AFORCE DP-01 Display Plinth")
    pe2 = d[:plinth].entities
    box(pe2, 0, 0, 0, PLINTH_W_IN, PLINTH_W_IN, PLINTH_H_IN - 0.5, m[:charcoal])
    box(pe2, 0, 0, PLINTH_H_IN - 0.5, PLINTH_W_IN, PLINTH_W_IN, 0.5, m[:metal])
    can = group(pe2, "Product placeholder (can)", nil, m[:metal])
    cylinder(can.entities, 5.0, 8.0, PLINTH_H_IN, 1.3, 6.0)
    stick = group(pe2, "Product placeholder (stick box 4x1.5x5)", nil, m[:placeholder])
    box(stick.entities, 9.0, 7.0, PLINTH_H_IN, 4.0, 1.5, 5.0)

    # FN-01 bench 6ft x 18 x 18
    d[:bench] = model.definitions.add("AFORCE FN-01 Lounge Bench 6ft")
    bn = d[:bench].entities
    box(bn, 0, 0, 0, f(BENCH_L), BENCH_D_IN, BENCH_H_IN - 3.0, m[:charcoal])
    box(bn, 0, 0, BENCH_H_IN - 3.0, f(BENCH_L), BENCH_D_IN, 3.0, m[:paper])

    # FN-02 stool 16 dia x 18
    d[:stool] = model.definitions.add("AFORCE FN-02 Stool 16in")
    st = d[:stool].entities
    cylinder(st, 0, 0, 0, STOOL_DIA_IN / 2.0 - 3.0, STOOL_H_IN - 2.0, m[:metal], 16)
    cylinder(st, 0, 0, STOOL_H_IN - 2.0, STOOL_DIA_IN / 2.0, 2.0, m[:paper], 16)

    # UT-01..03 utility allowances (conceptual space only)
    d[:water]  = model.definitions.add("AFORCE UT-01 Water Supply Allowance 24x24x36")
    box(d[:water].entities, 0, 0, 0, 24.0, 24.0, 36.0, m[:utility])
    d[:cooler] = model.definitions.add("AFORCE UT-02 Cooling-Ice Allowance 36x24x34")
    box(d[:cooler].entities, 0, 0, 0, 36.0, 24.0, 34.0, m[:utility])
    d[:power]  = model.definitions.add("AFORCE UT-03 Power Distribution Allowance 12x12x18")
    box(d[:power].entities, 0, 0, 0, 12.0, 12.0, 18.0, m[:utility])

    # RF-01 reference figure 5ft-10in, low poly
    d[:figure] = model.definitions.add("AFORCE RF-01 Reference Figure 5ft-10in")
    fe = d[:figure].entities
    box(fe, -7.0, -4.0, 0, 14.0, 8.0, 32.0, m[:ghost])
    box(fe, -9.0, -5.0, 32.0, 18.0, 10.0, 26.0, m[:ghost])
    cylinder(fe, 0, 0, 59.0, 4.0, 10.0, m[:ghost], 12)
    cylinder(fe, 0, 0, 58.0, 2.5, 2.0, m[:ghost], 12)

    # SG-03 N-N monogram: left N forward, right N mirrored, Signal Red divider.
    d[:monogram] = model.definitions.add("AFORCE SG-03 Monogram N-N Placeholder 36in")
    build_monogram(d[:monogram].entities, 36.0, m[:red])

    # SG-01 / SG-02 / SG-04..07 text definitions
    d[:sign]    = text_definition(model, "AFORCE SG-01 Sign Letters 18in", BRAND_WORD, 18.0, 2.0, m[:paper])
    d[:tagline] = text_definition(model, "AFORCE SG-02 Brand Line 5in", BRAND_LINE, 5.0, 0.5, m[:paper])
    d[:ritual] = RITUAL.each_with_index.map do |word, i|
      mat = (i == LOCK_IN_INDEX) ? m[:red] : m[:paper]
      text_definition(model, "AFORCE SG-0#{4 + i} Ritual Word #{i + 1}", word, 5.0, 0.5, mat)
    end
    d
  end

  # N–N monogram built from outline polygons. total width = h * 1.95
  def self.build_monogram(ents, h, mat)
    s = h * 0.11             # stroke
    w = h * 0.72             # letter width
    dj = s * 1.45            # diagonal join height
    gap = h * 0.5
    n_pts = [[0, 0], [s, 0], [s, h - dj], [w - s, 0], [w, 0], [w, h], [w - s, h], [w - s, dj], [s, h], [0, h]]
    left  = n_pts.map { |x, z| pti(x, 0, z) }
    right = n_pts.map { |x, z| pti(w + gap + (w - x), 0, z) }    # mirrored via x -> w - x
    [left, right].each do |pts|
      face = ents.add_face(pts)
      face.reverse! if face.normal.y > 0
      face.material = mat
      face.back_material = mat
      face.pushpull(1.0)
    end
    bar = ents.add_face(pti(w + s * 0.3, 0, h / 2.0 - s * 0.4), pti(w + gap - s * 0.3, 0, h / 2.0 - s * 0.4),
                        pti(w + gap - s * 0.3, 0, h / 2.0 + s * 0.4), pti(w + s * 0.3, 0, h / 2.0 + s * 0.4))
    bar.reverse! if bar.normal.y > 0
    bar.material = mat
    bar.back_material = mat
    bar.pushpull(1.0)
  end

  # ------------------------------------------------------------------ shared builders
  # Back wall of n panels along x from x0, front face at y_face (inches).
  def self.build_back_wall(ents, d, m, t, x0, y_face, n_panels, with_city_placeholder)
    wall = group(ents, "Back Wall (BW-01 x#{n_panels}, transportable panels)", t[:wall])
    we = wall.entities
    n_panels.times do |i|
      x = x0 + f(PANEL_W) * i + PANEL_REVEAL_IN
      inst = place(we, d[:panel], x, y_face, 0, t[:wall], 0, "BW-01 Panel #{i + 1} of #{n_panels}")
      inst.set_attribute("AFORCE", "module", "BW-01-#{i + 1}")
    end
    # LT-01 top LED channel, full width, 2in x 1in, face-mounted
    led = group(we, "LT-01 Top lighting channel", t[:lighting], m[:led])
    box(led.entities, x0, y_face - 1.0, f(PANEL_H) - 4.0, f(PANEL_W) * n_panels, 1.0, 2.0)
    # BW-02 replaceable city graphic placeholder on panel 1
    if with_city_placeholder
      art = group(we, "BW-02 Replaceable city graphic placeholder (LA / PHX) 3x6ft", t[:signage], m[:placeholder])
      front_slab(art.entities, x0 + 6.0, y_face, f(2.0), f(3.0), f(6.0), 0.25)
    end
    wall
  end

  def self.build_signage(ents, d, m, t, x_center_in, y_face, monogram_x_in)
    sg = group(ents, "Signage", t[:signage])
    se = sg.entities
    place(se, d[:sign],    x_center_in, y_face, f(7.0), t[:signage], 0, "SG-01 AFORCE sign (editable placeholder text)")
    place(se, d[:tagline], x_center_in, y_face, f(6.0) + 2.0, t[:signage], 0, "SG-02 Brand line (editable placeholder text)")
    mono = place(se, d[:monogram], monogram_x_in - 36.0 * 1.95 / 2.0, y_face, f(5.0), t[:signage], 0, "SG-03 N-N monogram placeholder (replace with supplied vector)")
    halo = group(se, "LT-04 Monogram halo channel", t[:lighting], m[:led])
    box(halo.entities, monogram_x_in - 42.0, y_face - 0.5, f(5.0) - 6.0, 84.0, 0.5, 1.0)
    box(halo.entities, monogram_x_in - 42.0, y_face - 0.5, f(5.0) + 42.0, 84.0, 0.5, 1.0)
    mono
  end

  # Hydration counter: two CTR-01 modules + CTR-02 ledge. x0 = left end (in), y_front (in)
  def self.build_counter(ents, d, m, t, x0, y_front)
    ctr = group(ents, "Hydration Counter (CTR-01 x2 + CTR-02)", t[:counter])
    ce = ctr.entities
    a = place(ce, d[:counter], x0, y_front, 0, t[:counter], 0, "CTR-01 Module A (niches: Watermelon, Soursop)")
    b = place(ce, d[:counter], x0 + f(COUNTER_MOD_W), y_front, 0, t[:counter], 0, "CTR-01 Module B (niches: Berry, Sticks)")
    a.set_attribute("AFORCE", "module", "CTR-01-A")
    b.set_attribute("AFORCE", "module", "CTR-01-B")
    # flavour accent chips on the niche light panels (editable materials)
    chips = group(ce, "Flavor accent chips (editable)", t[:counter])
    [[1.25, m[:watermelon]], [3.75, m[:soursop]], [6.25, m[:berry]], [8.75, m[:paper]]].each do |nx, mat|
      c = group(chips.entities, "Chip", nil, mat)
      box(c.entities, x0 + f(nx) - 6.0, y_front + f(COUNTER_D) - 8.5, COUNTER_H_IN + 13.0, 12.0, 0.5, 1.0)
    end
    note(ce, "Panel joint CTR-01 A/B: draw-latch + top seam strip (fabricator to confirm)",
         x0 + f(COUNTER_MOD_W), y_front, COUNTER_H_IN, t[:dims], [0, -30, 12])
    place(ce, d[:ledge], x0 + f(COUNTER_MOD_W * 2) - LEDGE_W_IN - 6.0, y_front - LEDGE_D_IN, 0, t[:counter], 0,
          "CTR-02 Accessible service ledge (34in)")
    hyd = place(ce, d[:ritual][1], x0 + f(COUNTER_MOD_W), y_front, 24.0, t[:signage], 0, "SG-05 HYDRATE. (fascia)")
    ctr
  end

  def self.add_ritual_word(ents, d, t, index, x_in, y_in, z_in, rot, name)
    place(ents, d[:ritual][index], x_in, y_in, z_in, t[:signage], rot, name)
  end

  # Floor markers for the four ritual steps + guest path strips
  def self.floor_marker(ents, m, t, x_in, y_in, w_in, d_in, label)
    g = group(ents, "FP-02 Floor marker: #{label}", t[:footprint], m[:paper])
    flat(g.entities, x_in, y_in, 0.125, w_in, d_in)
    g
  end

  # ------------------------------------------------------------------ FULL 20x20
  def self.build_full(parent, d, m, t)
    cfg = group(parent.entities, "CONFIG A — Full 20x20 (max height 10ft)", t[:cfg_full])
    e = cfg.entities
    y_wall = f(FOOT_D) - f(PANEL_T)          # wall front face at 19.5 ft

    floor = group(e, "FP-01 Footprint 20x20 (floor graphic, no raised deck)", t[:footprint], m[:floor])
    flat(floor.entities, 0, 0, 0, f(FOOT_W), f(FOOT_D))
    # guest path strip (Paper hairline) : entry left -> counter -> right bay -> exit
    path = group(e, "FP-02 Guest path hairline", t[:footprint], m[:paper])
    flat(path.entities, f(4.75), f(1.0), 0.125, 2.0, f(11.0))
    flat(path.entities, f(4.75), f(12.0), 0.125, f(12.5), 2.0)
    flat(path.entities, f(17.25), f(1.0), 0.125, 2.0, f(11.2))
    floor_marker(e, m, t, f(1.0), f(0.25), f(4.0), 6.0, "01 PAUSE (entry threshold)")
    floor_marker(e, m, t, f(5.0), f(12.75), f(10.0), 6.0, "02 HYDRATE (guest line at counter)")
    floor_marker(e, m, t, f(15.5), f(11.0), f(4.0), 6.0, "03 LOCK-IN (bay threshold)")
    floor_marker(e, m, t, f(15.0), f(0.25), f(4.0), 6.0, "04 PERFORM (exit)")
    photo = group(e, "FP-03 Photo spot marker (content location)", t[:footprint], m[:red])
    flat(photo.entities, f(17.25), f(17.0), 0.125, 18.0, 18.0)

    build_back_wall(e, d, m, t, 0, y_wall, 5, true)
    build_signage(e, d, m, t, f(9.0), y_wall, f(18.0))
    build_counter(e, d, m, t, f(5.0), f(14.0))

    # Stations
    stations = group(e, "Stations", t[:stations])
    se = stations.entities
    place(se, d[:welcome], f(1.5), f(3.5), 0, t[:stations], 0, "ST-01 Welcome / demo station (34in, accessible)")
    add_ritual_word(se, d, t, 0, f(1.5) + WELCOME_W_IN / 2.0, f(3.5), 20.0, 0, "SG-04 PAUSE. (station front)")
    totem = place(se, d[:totem], f(16.5), f(12.5), 0, t[:stations], 0, "ST-02 Lock-In totem (OS demo + intention)")
    totem.set_attribute("AFORCE", "module", "ST-02")
    add_ritual_word(se, d, t, 2, f(16.5) + f(TOTEM_W) / 2.0, f(12.5), 30.0, 0, "SG-06 LOCK-IN. (totem front, Signal Red)")
    place(se, d[:blade], f(19.0), f(1.0), 0, t[:stations], 0, "ST-03 Perform exit blade")
    add_ritual_word(se, d, t, 3, f(19.0) + 6.0, f(1.0), 44.0, 0, "SG-07 PERFORM. (exit blade)")

    # Displays
    disp = group(e, "Displays (DP-01 x2)", t[:displays])
    place(disp.entities, d[:plinth], f(0.75), f(9.0), 0, t[:displays], 0, "DP-01 Plinth 1 (between Pause and Hydrate)")
    place(disp.entities, d[:plinth], f(18.0), f(6.5), 0, t[:displays], 0, "DP-01 Plinth 2 (Perform landing)")

    # Furniture / lounge
    fn = group(e, "Lounge (FN-01 + FN-02 x3)", t[:furniture])
    place(fn.entities, d[:bench], f(10.5), f(2.0), 0, t[:furniture], 0, "FN-01 Bench")
    place(fn.entities, d[:stool], f(11.0), f(6.0), 0, t[:furniture], 0, "FN-02 Stool 1")
    place(fn.entities, d[:stool], f(13.5), f(7.0), 0, t[:furniture], 0, "FN-02 Stool 2")
    place(fn.entities, d[:stool], f(9.0), f(4.5), 0, t[:furniture], 0, "FN-02 Stool 3")

    # Utilities (conceptual allowances; venue utilities not assumed)
    ut = group(e, "Utilities — conceptual allowances only", t[:utilities])
    ue = ut.entities
    place(ue, d[:water],  f(0.5), f(16.75), 0, t[:utilities], 0, "UT-01 Water supply allowance (self-contained, 24x24x36)")
    place(ue, d[:cooler], f(3.0), f(16.75), 0, t[:utilities], 0, "UT-02 Cooling / ice allowance (36x24x34)")
    place(ue, d[:power],  f(6.5), f(18.25), 0, t[:utilities], 0, "UT-03 Power distribution allowance (venue feed or battery TBD)")
    cable = group(ue, "UT-04 Cable route + ramp allowance (2in x 0.5in)", t[:utilities], m[:utility])
    box(cable.entities, f(6.5), y_wall - 3.0, 0, f(10.5), 2.0, 0.5)              # along wall base to x=17
    box(cable.entities, f(17.0), f(14.5), 0, 2.0, f(5.0) - 3.0, 0.5)             # forward to totem
    box(cable.entities, f(0.5), f(16.0), 0, f(6.0), 2.0, 0.5)                    # across utility corner
    note(ue, "STAFF WORK ZONE 3ft-6in deep: storage, water, cooling, waste. No venue utilities assumed.",
         f(10.0), f(17.5), 0, t[:utilities], [0, 24, 36])
    note(ue, "LOCK-IN BAY: Lock-In totem + photo spot; cable crossing needs ramp.",
         f(17.5), f(16.0), 0, t[:utilities], [-36, 0, 36])

    # Reference figures
    rf = group(e, "Reference figures (RF-01 x3)", t[:figures])
    place(rf.entities, d[:figure], f(3.0), f(6.0), 0, t[:figures], 180, "RF-01 Guest at Pause")
    place(rf.entities, d[:figure], f(10.0), f(12.0), 0, t[:figures], 0, "RF-01 Guest at Hydrate")
    place(rf.entities, d[:figure], f(10.0), f(17.5), 0, t[:figures], 180, "RF-01 Staff behind counter")

    # Dimensions
    dm = group(e, "Dimensions + notes", t[:dims])
    de = dm.entities
    dim(de, pt(0, 0, 0), pt(FOOT_W, 0, 0), Geom::Vector3d.new(0, -36, 0), t[:dims])                 # 20'-0"
    dim(de, pt(0, 0, 0), pt(0, FOOT_D, 0), Geom::Vector3d.new(-36, 0, 0), t[:dims])                 # 20'-0"
    dim(de, pt(5, 14, 0), pt(15, 14, 0), Geom::Vector3d.new(0, -18, 0), t[:dims])                   # counter 10'
    dim(de, pt(15, 14, 0), pt(15, 16, 0), Geom::Vector3d.new(18, 0, 0), t[:dims])                   # counter 2'
    dim(de, pt(10, 9, 0), pt(10, 14, 0), Geom::Vector3d.new(-24, 0, 0), t[:dims])                   # 5' circulation
    dim(de, pt(10, 16, 0), pt(10, 19.5, 0), Geom::Vector3d.new(-24, 0, 0), t[:dims])                # 3'-6" staff
    dim(de, pt(20, 20, 0), pt(20, 20, MAX_H), Geom::Vector3d.new(24, 0, 0), t[:dims])               # 10' height
    dim(de, pti(f(15.0), f(14.0), 0), pti(f(15.0), f(14.0), COUNTER_H_IN), Geom::Vector3d.new(24, 0, 0), t[:dims]) # 42"
    dim(de, pt(0, 19.5, 0), pt(4, 19.5, 0), Geom::Vector3d.new(0, 30, 0), t[:dims])                  # panel 4'
    note(de, "Panel joint BW-01: 1/2in lit reveal, cam-lock between panels (fabricator to confirm)",
         f(4.0), y_wall, f(5.0), t[:dims], [-24, -30, 24])
    note(de, "Entry: 6ft clear", f(3.0), 0, 0, t[:dims], [0, -30, 0])
    note(de, "Exit: 4ft clear", f(17.0), 0, 0, t[:dims], [0, -30, 0])

    # Ritual map annotations (visible only in scene 09)
    rm = group(e, "Ritual map annotations", t[:ritual_map])
    re = rm.entities
    [
      ["01 PAUSE — guest stops at threshold; host greets; tablet: waitlist / Founding 250. #{RITUAL_SUBLINES[0]}", 3.0, 3.0],
      ["02 HYDRATE — sample at counter; 4 niches: Watermelon / Soursop / Berry / Sticks; accessible ledge right end. #{RITUAL_SUBLINES[1]}", 10.0, 13.0],
      ["03 LOCK-IN — totem: set an intention in the OS demo; monogram photo spot behind. #{RITUAL_SUBLINES[2]}", 17.5, 12.0],
      ["04 PERFORM — exit blade + lounge landing; carry the can out. #{RITUAL_SUBLINES[3]}", 17.0, 2.0],
      ["GROUP FLOW: up to 4 guests line the 10ft counter; singles pass left to right without blocking the staff zone.", 10.0, 7.0],
      ["STAFF ZONE 3ft-6in: product, cups, waste, water, cooling; two staff behind counter, one host at Pause.", 10.0, 18.0]
    ].each do |txt, x, y|
      note(re, txt, pt(x, y, 0.5).x, pt(x, y, 0.5).y, 6.0, t[:ritual_map], [0, 0, 60])
    end
    cfg
  end

  # ------------------------------------------------------------------ COMPACT 10x20
  def self.build_compact(parent, d, m, t)
    cfg = group(parent.entities, "CONFIG B — Compact 10x20 (same core modules)", t[:cfg_compact])
    cfg.transform!(Geom::Transformation.translation(pt(CONFIG_X_COMPACT, 0, 0)))
    e = cfg.entities
    y_wall = f(COMPACT_D) - f(PANEL_T)        # 9.5 ft

    floor = group(e, "FP-01 Footprint 10x20 (floor graphic)", t[:footprint], m[:floor])
    flat(floor.entities, 0, 0, 0, f(COMPACT_W), f(COMPACT_D))
    path = group(e, "FP-02 Guest path hairline (linear left to right)", t[:footprint], m[:paper])
    flat(path.entities, f(1.5), f(3.5), 0.125, f(17.0), 2.0)
    floor_marker(e, m, t, f(0.5), f(0.25), f(3.0), 6.0, "01 PAUSE")
    floor_marker(e, m, t, f(5.0), f(4.25), f(10.0), 6.0, "02 HYDRATE")
    floor_marker(e, m, t, f(16.0), f(4.25), f(3.5), 6.0, "03 LOCK-IN")
    floor_marker(e, m, t, f(16.5), f(0.25), f(3.0), 6.0, "04 PERFORM")
    photo = group(e, "FP-03 Photo spot marker", t[:footprint], m[:red])
    flat(photo.entities, f(17.25), f(7.0), 0.125, 18.0, 18.0)

    build_back_wall(e, d, m, t, 0, y_wall, 5, true)
    build_signage(e, d, m, t, f(9.0), y_wall, f(18.0))
    build_counter(e, d, m, t, f(5.0), f(5.5))

    stations = group(e, "Stations", t[:stations])
    se = stations.entities
    place(se, d[:welcome], f(1.0), f(1.5), 0, t[:stations], 0, "ST-01 Welcome / demo station")
    add_ritual_word(se, d, t, 0, f(1.0) + WELCOME_W_IN / 2.0, f(1.5), 20.0, 0, "SG-04 PAUSE.")
    place(se, d[:totem], f(16.0), f(6.0), 0, t[:stations], 0, "ST-02 Lock-In totem")
    add_ritual_word(se, d, t, 2, f(16.0) + f(TOTEM_W) / 2.0, f(6.0), 30.0, 0, "SG-06 LOCK-IN.")
    place(se, d[:blade], f(19.0), f(0.5), 0, t[:stations], 0, "ST-03 Perform exit blade")
    add_ritual_word(se, d, t, 3, f(19.0) + 6.0, f(0.5), 44.0, 0, "SG-07 PERFORM.")

    disp = group(e, "Displays (DP-01 x1)", t[:displays])
    place(disp.entities, d[:plinth], f(2.5), f(6.5), 0, t[:displays], 0, "DP-01 Plinth 1")

    fn = group(e, "Lounge (FN-01 + FN-02 x2)", t[:furniture])
    place(fn.entities, d[:bench], f(9.0), f(0.5), 0, t[:furniture], 0, "FN-01 Bench")
    place(fn.entities, d[:stool], f(7.5), f(2.0), 0, t[:furniture], 0, "FN-02 Stool 1")
    place(fn.entities, d[:stool], f(16.0), f(2.5), 0, t[:furniture], 0, "FN-02 Stool 2")

    ut = group(e, "Utilities — conceptual allowances only", t[:utilities])
    ue = ut.entities
    place(ue, d[:water],  f(0.25), f(7.25), 0, t[:utilities], 0, "UT-01 Water supply allowance")
    place(ue, d[:cooler], f(2.5), f(7.5), 0, t[:utilities], 0, "UT-02 Cooling / ice allowance")
    place(ue, d[:power],  f(19.0), f(8.25), 0, t[:utilities], 0, "UT-03 Power distribution allowance")
    cable = group(ue, "UT-04 Cable route allowance", t[:utilities], m[:utility])
    box(cable.entities, f(17.0), y_wall - 3.0, 0, f(2.0), 2.0, 0.5)
    box(cable.entities, f(17.0), f(8.0), 0, 2.0, f(1.5) - 3.0, 0.5)
    note(ue, "STAFF ZONE 2ft (tight): single server; restock from the right bay.", f(10.0), f(8.5), 0, t[:utilities], [0, 12, 36])

    rf = group(e, "Reference figures (RF-01 x2)", t[:figures])
    place(rf.entities, d[:figure], f(10.0), f(3.5), 0, t[:figures], 0, "RF-01 Guest at Hydrate")
    place(rf.entities, d[:figure], f(10.0), f(8.5), 0, t[:figures], 180, "RF-01 Staff")

    dm = group(e, "Dimensions", t[:dims])
    de = dm.entities
    dim(de, pt(0, 0, 0), pt(COMPACT_W, 0, 0), Geom::Vector3d.new(0, -36, 0), t[:dims])
    dim(de, pt(0, 0, 0), pt(0, COMPACT_D, 0), Geom::Vector3d.new(-36, 0, 0), t[:dims])
    dim(de, pt(5, 5.5, 0), pt(15, 5.5, 0), Geom::Vector3d.new(0, -18, 0), t[:dims])
    dim(de, pt(10, 1.5, 0), pt(10, 5.5, 0), Geom::Vector3d.new(-24, 0, 0), t[:dims])   # 4' guest zone
    cfg
  end

  # ------------------------------------------------------------------ PACKING LAYOUT
  def self.build_packing(parent, d, m, t)
    cfg = group(parent.entities, "CONFIG C — Exploded module / packing layout", t[:cfg_packing])
    cfg.transform!(Geom::Transformation.translation(pt(CONFIG_X_PACKING, 0, 0)))
    e = cfg.entities
    ref = group(e, "Reference floor 26ft x 8ft (layout grid only — NOT a verified load plan)", t[:footprint], m[:floor])
    flat(ref.entities, 0, 0, 0, f(26.0), f(8.0))
    note(e, "PACKING LAYOUT — major modules, one set. Grid is a drawing aid only. Case counts, weights and truck capacity to be validated by the fabricator / carrier.",
         f(1.0), f(8.0), 0, t[:dims], [0, 24, 48])

    lay = group(e, "Modules", t[:dims])
    le = lay.entities
    flat_rot = Geom::Transformation.rotation(ORIGIN, X_AXIS, 90.degrees)   # stands a panel on its back (flat, face up)
    # 5 wall panels flat, stacked side by side (x), each 4ft wide x 10ft long
    5.times do |i|
      tr = Geom::Transformation.translation(pt(0.5 + i * 4.25, 10.0 + 0.0, 0)) * Geom::Transformation.rotation(ORIGIN, X_AXIS, -90.degrees)
      inst = le.add_instance(d[:panel], tr)
      inst.layer = t[:wall]
      inst.name = "BW-01 Panel #{i + 1} (flat, face up)"
    end
    note(le, "BW-01 x5 wall panels 4x10x0.5ft — flat, face up, edge-protected", pt(2.0, 10.5, 0).x, pt(2.0, 10.5, 0).y, 6.0, t[:dims], [0, -24, 36])
    # row 1 on the reference floor
    place(le, d[:counter], f(0.5), f(0.5), 0, t[:counter], 0, "CTR-01 Module A")
    place(le, d[:counter], f(6.0), f(0.5), 0, t[:counter], 0, "CTR-01 Module B")
    place(le, d[:totem], f(11.5), f(0.5), 0, t[:stations], 0, "ST-02 Lock-In totem (ships upright or flat in case)")
    place(le, d[:welcome], f(14.0), f(0.5), 0, t[:stations], 0, "ST-01 Welcome station")
    place(le, d[:plinth], f(17.0), f(0.5), 0, t[:displays], 0, "DP-01 Plinth 1")
    place(le, d[:plinth], f(18.75), f(0.5), 0, t[:displays], 0, "DP-01 Plinth 2")
    place(le, d[:blade], f(20.5), f(0.5), 0, t[:stations], 0, "ST-03 Exit blade")
    place(le, d[:ledge], f(22.0), f(0.5), 0, t[:counter], 0, "CTR-02 Ledge")
    # row 2
    place(le, d[:bench], f(0.5), f(4.0), 0, t[:furniture], 0, "FN-01 Bench")
    place(le, d[:stool], f(7.5), f(4.75), 0, t[:furniture], 0, "FN-02 Stool 1")
    place(le, d[:stool], f(9.0), f(4.75), 0, t[:furniture], 0, "FN-02 Stool 2")
    place(le, d[:stool], f(10.5), f(4.75), 0, t[:furniture], 0, "FN-02 Stool 3")
    place(le, d[:water],  f(12.0), f(4.0), 0, t[:utilities], 0, "UT-01 Water allowance")
    place(le, d[:cooler], f(14.5), f(4.0), 0, t[:utilities], 0, "UT-02 Cooling allowance")
    place(le, d[:power],  f(18.0), f(4.0), 0, t[:utilities], 0, "UT-03 Power allowance")
    sign = place(le, d[:sign], f(22.5), f(6.5), 0, t[:signage], 0, "SG-01 Sign letters (crated)")
    mono = place(le, d[:monogram], f(19.5), f(6.5), 0, t[:signage], 0, "SG-03 Monogram")
    [["CTR-01 x2 counter modules 5x2ft x 42in", 3.0, 0.5], ["ST-02 totem 2x2x7ft", 12.5, 0.5],
     ["ST-01 welcome 30x20x34in", 15.0, 0.5], ["DP-01 x2 plinths 16x16x40in", 18.0, 0.5],
     ["FN-01 bench 6ft + FN-02 x3 stools", 3.0, 4.0], ["UT-01/02/03 utility cases", 14.0, 4.0],
     ["SG-01/02/03 signage crate + LT-01..04 lighting channels (coiled)", 20.0, 6.5]].each do |txt, x, y|
      note(le, txt, pt(x, y, 0).x, pt(x, y, 0).y, 48.0, t[:dims], [0, -12, 30])
    end
    cfg
  end

  # ------------------------------------------------------------------ SCENES
  def self.set_tags(t, visible_keys)
    t.each { |k, layer| layer.visible = visible_keys.include?(k) }
  end

  def self.scene(model, name, eye, target, perspective, fov_or_height, desc)
    cam = Sketchup::Camera.new(eye, target, Z_AXIS, perspective)
    if perspective
      cam.fov = fov_or_height
    else
      cam.height = fov_or_height
    end
    model.active_view.camera = cam
    page = model.pages.add(name)
    page.description = desc
    page
  end

  def self.build_scenes(model, t)
    all      = t.keys
    base     = all - [:cfg_compact, :cfg_packing, :ritual_map]
    hero     = base - [:dims, :utilities]
    guest    = base - [:dims, :utilities]
    ox       = f(CONFIG_X_COMPACT)
    px       = f(CONFIG_X_PACKING)
    ro       = model.rendering_options
    old_bg   = ro["BackgroundColor"]
    si       = model.shadow_info
    old_shadows = si["DisplayShadows"]

    set_tags(t, hero)
    scene(model, "01 Hero Front-Left", pt(-11, -20, 7.5), pt(10, 11, 4), true, 55,
          "Full 20x20 configuration from front-left: Pause threshold in the foreground, counter and brand wall beyond.")
    scene(model, "02 Hero Front-Right", pt(31, -20, 7.5), pt(10, 11, 4), true, 55,
          "Full configuration from front-right: Perform landing and lounge in the foreground, Lock-In bay beyond.")
    set_tags(t, base)
    scene(model, "03 Front Elevation", pt(10, -60, 5), pt(10, 10, 5), false, f(16.0),
          "Parallel front elevation with heights: 10ft wall, 42in counter, 34in accessible ledge, 7ft totem.")
    scene(model, "04 Overhead Plan (Dimensioned)", pt(10, 10, 80), pt(10, 10, 0), false, f(30.0),
          "Dimensioned plan: 20x20 footprint, 10x2 counter, 5ft circulation, 3ft-6in staff zone, 6ft entry / 4ft exit.")
    set_tags(t, base - [:figures])
    scene(model, "05 Staff-Side Counter (Ritual Support)", pt(10, 18.75, 5.5), pt(10, 6, 2.5), true, 65,
          "From behind the counter: concealed storage, waste, cups, water and cooling allowances, cable route, Lock-In bay restock path.")
    # Evening lighting concept: dark background, shadows on at dusk
    set_tags(t, hero)
    ro["BackgroundColor"] = Sketchup::Color.new(13, 13, 13)
    ro["DrawHorizon"] = false
    ro["DrawGround"] = false
    si["DisplayShadows"] = true
    begin
      si["ShadowTime"] = Time.local(2027, 2, 13, 18, 30)
    rescue StandardError
      nil
    end
    scene(model, "06 Evening Lighting Concept", pt(-9, -18, 6), pt(10, 12, 4.5), true, 55,
          "Evening concept: warm-white top channel + lit panel reveals, backlit niches, monogram halo, single Signal Red channel at Lock-In. Lighting fixtures are placeholders for the lighting vendor.")
    ro["BackgroundColor"] = old_bg
    ro["DrawHorizon"] = true
    ro["DrawGround"] = false
    si["DisplayShadows"] = old_shadows
    # Compact
    compact = (all - [:cfg_full, :cfg_packing, :ritual_map, :dims, :utilities])
    set_tags(t, compact)
    scene(model, "07 Compact 10x20", pti(ox - f(10), f(-18), f(7)), pti(ox + f(10), f(6), f(4)), true, 55,
          "Compact 10x20 using the same core modules; ritual runs linearly left to right and is complete.")
    # Packing
    set_tags(t, all - [:cfg_full, :cfg_compact, :ritual_map, :figures])
    scene(model, "08 Exploded Packing Layout", pti(px + f(13), f(-22), f(26)), pti(px + f(13), f(6), f(0)), true, 50,
          "Major modules laid out and labelled. Grid is a drawing aid, not a verified load plan.")
    # Ritual map
    set_tags(t, base + [:ritual_map] - [:figures, :utilities])
    scene(model, "09 Ritual Map Overhead (Annotated)", pt(10, 10, 80), pt(10, 10, 0), false, f(30.0),
          "Guest journey mapped to the ritual: 01 Pause (entry) -> 02 Hydrate (counter) -> 03 Lock-In (totem + photo) -> 04 Perform (exit + lounge).")
    # Guest-eye views
    set_tags(t, guest)
    eh = EYE_H_IN / 12.0
    scene(model, "10 Guest Eye — 01 Pause", pt(3, -3, eh), pt(2.75, 5, 3.2), true, 60,
          "Arriving at the threshold: welcome station, PAUSE., host position, brand wall in the distance.")
    scene(model, "11 Guest Eye — 02 Hydrate", pt(10, 9.5, eh), pt(10, 16, 3.8), true, 60,
          "At the counter: HYDRATE., four backlit niches, sample handed across the 42in top or the 34in ledge.")
    scene(model, "12 Guest Eye — 03 Lock-In", pt(13.5, 8.5, eh), pt(17.5, 15, 4.5), true, 60,
          "Turning into the Lock-In bay: totem with OS demo tablet, Signal Red channel, monogram photo spot behind.")
    scene(model, "13 Guest Eye — 04 Perform", pt(17, 13, eh), pt(16, 1, 3.5), true, 60,
          "Leaving the bay toward the exit: PERFORM. blade, lounge landing, back into the event.")
    set_tags(t, base)
    model.pages.selected_page = model.pages[0]
  end

  # ------------------------------------------------------------------ RUN
  def self.run
    model = Sketchup.active_model
    model.start_operation("AFORCE Activation Set v01", true)
    begin
      # Display units: architectural feet-inches
      uo = model.options["UnitsOptions"]
      uo["LengthFormat"] = 1
      uo["LengthUnit"] = 0

      m = {
        black:       material(model, "AFORCE Black #0D0D0D", AFORCE_BLACK),
        charcoal:    material(model, "AFORCE Charcoal Matte", CHARCOAL),
        floor:       material(model, "AFORCE Floor Charcoal", [28, 28, 28]),
        paper:       material(model, "AFORCE Paper Warm White", PAPER),
        metal:       material(model, "AFORCE Brushed Metal", BRUSHED_METAL),
        red:         material(model, "AFORCE Signal Red (accent, interchangeable)", SIGNAL_RED),
        led:         material(model, "AFORCE LED Warm White", LED_WARM, 0.9),
        watermelon:  material(model, "AFORCE Flavor Watermelon", FLAVOR_WATERMELON),
        soursop:     material(model, "AFORCE Flavor Soursop", FLAVOR_SOURSOP),
        berry:       material(model, "AFORCE Flavor Berry", FLAVOR_BERRY),
        placeholder: material(model, "AFORCE Artwork Placeholder", PLACEHOLDER_GREY),
        utility:     material(model, "AFORCE Utility Allowance (ghost)", UTILITY_BLUE, 0.35),
        ghost:       material(model, "AFORCE Ghost Grey", [120, 120, 118], 0.45)
      }

      t = {
        footprint:   tag(model, "AFORCE - Footprint"),
        counter:     tag(model, "AFORCE - Counter"),
        wall:        tag(model, "AFORCE - Back Wall"),
        signage:     tag(model, "AFORCE - Signage"),
        lighting:    tag(model, "AFORCE - Lighting"),
        displays:    tag(model, "AFORCE - Displays"),
        furniture:   tag(model, "AFORCE - Furniture"),
        stations:    tag(model, "AFORCE - Stations"),
        utilities:   tag(model, "AFORCE - Utilities"),
        dims:        tag(model, "AFORCE - Dimensions"),
        figures:     tag(model, "AFORCE - Reference Figures"),
        ritual_map:  tag(model, "AFORCE - Ritual Map"),
        cfg_full:    tag(model, "AFORCE Config - A Full 20x20"),
        cfg_compact: tag(model, "AFORCE Config - B Compact 10x20"),
        cfg_packing: tag(model, "AFORCE Config - C Packing Layout")
      }

      stamp = Time.now.strftime("%Y%m%d_%H%M%S")
      parent = model.entities.add_group
      parent.name = "AFORCE_ActivationSet_v01_#{stamp}"
      parent.set_attribute("AFORCE", "version", "v01")
      parent.set_attribute("AFORCE", "brand_line", BRAND_LINE)

      d = build_definitions(model, m)
      build_full(parent, d, m, t)
      build_compact(parent, d, m, t)
      build_packing(parent, d, m, t)
      build_scenes(model, t)

      model.commit_operation
      puts "AFORCE Activation Set v01 built inside group '#{parent.name}'. 13 scenes added. Review each scene tab against ACTIVATION-SET-BRIEF.md."
    rescue StandardError => err
      model.abort_operation
      puts "AFORCE build failed and was rolled back: #{err.class}: #{err.message}"
      puts err.backtrace.first(8).join("\n")
    end
  end
end

AFORCE_ActivationSet.run
