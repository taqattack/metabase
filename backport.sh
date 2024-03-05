git reset HEAD~1
rm ./backport.sh
git cherry-pick c1c676c5ff250f7e252d3793a5107d16fd93224f
echo 'Resolve conflicts and force push this branch'
