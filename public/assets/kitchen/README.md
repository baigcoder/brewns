Real photos for the kitchen menu. Save each with exactly these names, as
.jpg, .png or .webp (square or 4:5, about 1000 px, dish centred on a plain or
softly blurred background). Any dish without a photo shows its drawn
illustration instead. The site picks up new photos on the next page load in
development, or the next build in production.

- `smash-burger.jpg`
- `zinger-burger.jpg`
- `bbq-burger.jpg`
- `alfredo-pasta.jpg`
- `arrabbiata-pasta.jpg`
- `pesto-pasta.jpg`
- `tikka-roll.jpg`
- `behari-roll.jpg`
- `crispy-wrap.jpg`
- `margherita-pizza.jpg`
- `fajita-pizza.jpg`
- `pepperoni-pizza.jpg`
- `mint-margarita.jpg`
- `peach-iced-tea.jpg`
- `mango-smoothie.jpg`
- `lime-soda.jpg`

Use only photos you have the rights to: your own shoot, or a library whose
licence allows commercial use (Unsplash, Pexels).

To cut the dishes out like the coffee shots (transparent background, centred,
soft shadow, so they sit straight on the cards), run this once after adding them:

    bun install
    bun run kitchen:white

It works on your own computer and only touches photos it hasn't done yet
(`bun run kitchen:white --all` redoes them all). The untouched originals are
kept in `assets-src/kitchen/`.
