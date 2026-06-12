# docs/demo.tape — renders the launch walkthrough to video.
#   vhs docs/demo.tape          → docs/demo.mp4 (~65s)
# Companion: demo-teaser.tape   → docs/demo-teaser.gif (money shot only)
#
# Timing contract with demo-play.sh: the player runs ~61s then holds the
# closing card for 12s. Sleep 64s stops the recording mid-hold, so the
# card is always the final frame — no frozen tail, no returning prompt.
# If you change the player's pacing, re-measure with
#   /usr/bin/time -p ./docs/demo-play.sh > /dev/null
# and set Sleep = runtime + ~3s (must stay below runtime + hold).

Output docs/demo.mp4

Set Shell bash
Set FontSize 17
Set Width 1280
Set Height 760
Set Padding 24
Set Theme "Catppuccin Mocha"

Hide
Type "./docs/demo-play.sh"
Show
Enter
Sleep 64s
