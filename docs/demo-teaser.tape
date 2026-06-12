# docs/demo-teaser.tape — ~20s GIF of the money shot (webhook wake)
# for embedding in the README / social posts.
#
# Same timing contract as demo.tape: teaser runs ~17s + 8s end hold;
# Sleep 19s stops mid-hold so the end card is the final frame.

Output docs/demo-teaser.gif

Set Shell bash
Set FontSize 18
Set Width 1100
Set Height 620
Set Padding 22
Set Theme "Catppuccin Mocha"

Hide
Type "TEASER=1 ./docs/demo-play.sh"
Show
Enter
Sleep 19s
