# WEJI motion study — two reference videos

Frame-by-frame study of the two videos the owner shared as the quality bar for WEJI's 3D and
motion (September 2026). The goal is to borrow **techniques and energy**, not either site's design:
WEJI must have its own identity.

---

## Reference 1 — agency site ("ALCHE"): loud, electric, futuristic

| Moment | What happens | Technique |
|---|---|---|
| Intro | A logo draws itself in thin lines, then a giant wordmark bursts in with light slashes and motion blur on electric blue | Stroke-draw animation, then type reveal with blur and chromatic streaks |
| Works gallery | The camera sits **inside** a curved room whose walls are a glowing tile grid. Project pictures ride along the curved wall and swing to the centre as you scroll | Scroll-driven cylindrical carousel, camera at the cylinder's centre, cards bent to the curvature |
| Between pictures | Refracting glass prisms and shard-like slabs sweep across; the image flashes bright with colour fringing | Transmission/refraction material, bloom flash, RGB split during transition |
| Room colour | The tile walls take on the colours of the picture in focus | Ambient tint sampled from the active image |
| Environment type | Giant 3D letters ("WORKS", the brand name) built into the room; the logo assembles from glass tiles | 3D text as scenery, not overlay |
| Picture open | A picture grows to fill the whole screen, full-bleed, with slightly bulged lens-like edges; no box, no caption card | Plane scaled to viewport with barrel distortion at edges |
| Section change | A white sheet curls up over the dark scene; images melt in like liquid; blocks dissolve into pixels | Curved-edge sheet wipe, displacement swirl, pixel dissolve |
| Big type | Huge words scroll in rows with fisheye distortion and strong colour fringing | Lens distortion + chromatic aberration on marquee text |
| Titles | Project titles swap with scramble/highlight-bar reveals | Text scramble, marker-bar reveal |
| Footer | Lines draw in like a technical drawing around the logo | SVG stroke animation |

**Palette:** calm black and electric blue as structure; explosive saturated imagery (magenta,
orange, cyan) as content.

## Reference 2 — travel site ("WanderLust"): calm, cinematic, hands-on

| Moment | What happens | Technique |
|---|---|---|
| Hero | Full-bleed landscape; a person stands in a separate foreground layer | Layered depth parallax |
| Reveal window | A rectangle slides over the hero showing a clearer, brighter version beneath | Masked reveal window tied to scroll/pointer |
| Destinations | ~20 polaroids scattered in a pile with random tilt; hovering a name in the list lifts its photo | Linked hover between list and image; card lift and rotate |
| Section exit | The pile flies up and away as the next section rises from below | Scroll-driven scatter-out, sheet rising |
| Collage | Polaroid, tape and torn paper stacked like a scrapbook | Layered physical objects |
| How We Travel | Tall image panels expand and collapse like an accordion as you scroll | Horizontal accordion driven by scroll |
| Closing | A misty panel slides over; a note pinned with a red pushpin | Sheet overlap, tactile detail |

**Palette:** charcoal, forest green, mist white, one red accent. Italic serif display type.

---

## Owner feedback on the first WEJI bloom preview

- **Too few pictures.** 48 tiles reads as a demo, not a search engine.
- **Opening a picture felt old and poor.** It was a lightbox: dark overlay, framed image, caption
  card. Both references avoid exactly that.

## Implications for WEJI's next version

1. **Put the viewer inside the scene** rather than in front of it, as in reference 1.
2. **Hundreds of pictures**, drawn efficiently (instanced geometry and texture atlases) so they can
   form the scenery itself rather than float in front of it.
3. **Opening = full-screen, lens-edged, colour-flooded**: the picture becomes the room, not a card
   in a box.
4. **Transitions are physical**: glass/refraction sweeps, liquid displacement, sheet wipes.
5. **Volume constraint:** Unsplash's demo tier allows 50 requests an hour, so most volume must come
   from Pexels plus the approved new sources (AniList for anime/manga, Openverse for open-licence
   images) until Unsplash grants Production access.

---

## Lessons from the owner's reference prompts

Three build prompts the owner shared as examples of strong work. Their assets (videos and images
on a third-party CDN) and fictional brands are **not** usable by WEJI; the techniques are.

### Prompt 1 — cinematic hero with looping video
- Full-bleed video background that fades into the page at top and bottom (gradient overlays).
- Seamless manual loop: fade out 0.5s before the end, reset, fade back in, so the jump never shows.
- Editorial headline: very large serif, tight tracking, emphasis words in italic grey.
- Staggered entrance: headline, then body, then button, 0.2s apart.

### Prompt 2 — interactive hero with scrubbed video
- **Pointer-scrubbed video**: horizontal mouse movement seeks a pre-rendered film. Film-quality
  "3D" at the cost of video playback. Needs an encode with frequent keyframes to scrub smoothly.
- Phones autoplay instead of scrubbing.
- Typewriter headline with blinking cursor.
- Multi-select pills with a spring-animated check; a status banner that springs open on selection.

### Prompt 3 — dark hero with a true 3D ring (the most relevant)
- **Camera at the centre of the ring.** 37 cards on a cylinder (R = perspective = 891px), each
  tangent to it; cards behind 42° are culled; the ring drifts continuously. This is the
  "inside the scene" effect of reference video 1, in CSS 3D.
- **Depth by overlap**: a UI panel sits in front of the ring's lower third.
- **Choreographed entrance** ("the eye is led, not sprayed"): nav → badge → headline wipes up out
  of its baseline via clip-path → sub → CTA → ring rises into depth → front panel lands last.
  Uses the individual `translate`/`scale` properties so it never fights transforms owned by the
  3D loop, then cancels its animations so the final frame is exactly the authored design.
- **Signature button material**: a bank of light pooled at the button's foot, clipped by its own
  rounded rect (`overflow:hidden`), plus a hairline top streak.
- Three responsive architectures (scaled canvas / tablet ramp / real phone column).
- Caveats: a pixel-locked non-scrolling canvas suits a landing hero, not search results; 37 cards
  is still too few for WEJI; the prompt's brightness formula brightens edges although its comment
  says it dims them — prompts contain mistakes and should be checked against the references.

### Lenis showcase (lenis.dev/showcase)
- The common thread of those ~190 sites is **weighted, smoothed scrolling** that drives the 3D and
  motion, instead of the page jumping line by line.
- Scroll speed itself is an input: fast scrolling bends, shears or colour-splits the scene, and it
  settles when the visitor stops.

## What WEJI built from all of this: the star lattice (/preview)

- **Room:** the visitor stands inside a ring of about 200 pictures cut into eight-point stars,
  with glass crosses between them (the star-and-cross tiling of Islamic geometric art).
- **Scroll:** Lenis turns the ring; speed pulls the wall closer and shears the band.
- **Pointer:** a lens of stars rises toward the cursor, and the star under it opens into a square.
- **Search:** a refracting glass eight-point star sweeps across, then a wave turns every star over
  to the new results.
- **Open:** the star unfolds its eight points like an aperture into a full-screen, lens-edged
  frame while the rest of the room falls away and floods with the picture's colours.
- **Entrance:** one star draws itself in light, then the pattern grows outward; the name rises out
  of its baseline, and the search bar lands last, in front of the room.
