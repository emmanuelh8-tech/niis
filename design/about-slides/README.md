# About page slides

`deck.html` draws the About page's slides: the nine that stack as the reader scrolls (`D`, from the
page's own copy) and the six country slides in the African Regional Report folder (`DC`). Each comes as
a 16:9 slide and a 4:5 flyer for phones. Headings are set in Delphin, text in Sully-Jonquières.

To change a slide, edit its words in `deck.html`, then:

    node design/about-slides/render.mjs      # full-size PNGs into about-slides/ (git-ignored)
    python design/about-slides/export.py     # the site's WebP copies into public/img/about/

`node design/about-slides/render.mjs 0.5 prev` makes quick half-size previews in `prev/`.

Delphin and Sully-Jonquières are licensed typefaces. Put their files in `public/fonts` as
`delphin.(woff2|woff|otf|ttf)` and `sully-jonquieres.(woff2|woff|otf|ttf)` and render again; until
then the free stand-ins Fondamento and Marcellus are drawn (the render script says which it used).

Each slide sets its subject in the upper-left corner: Liberia's counties (`public/liberia-counties.js`), a
country or region outline from `maps.js`, or an emblem (the Republic's seal, the Ministry of Posts &
Telecommunications' emblem `mopt-emblem.png`, the UN emblem `un-emblem.svg`, from Wikimedia Commons).
`maps.js` is made by `make-maps.py` from world-atlas's countries-50m (Natural Earth, public domain):

    python -I design/about-slides/make-maps.py path/to/countries-50m.json

Each slide's colours are its institution's or country's (the `t-*` themes in `deck.html`).
