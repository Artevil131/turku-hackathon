# apps

The mechanisms. Each app combines gears from `libs/utils` into something
a user touches, and keeps its own logic to presentation and wiring. Logic
that two apps need moves to `libs/utils`. Apps do not import each other.

    web/   the website
    ios/   the iPhone app
