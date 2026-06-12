# docs/demo.tape — renders the launch walkthrough to video.
#   vhs docs/demo.tape          → docs/demo.mp4 (full, ~2 min)
# Companion: demo-teaser.tape   → docs/demo-teaser.gif (money shot only)

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
Sleep 125s
