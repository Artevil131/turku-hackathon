# scripts

Every script: setup, data downloads, maintenance, one-off jobs. A script
is a thin entry point; logic worth reusing goes in `libs/utils` and the
script calls it. Each script states at the top what it does and how to
run it.
