<?php
$z = new ZipArchive();
foreach (['site_update.zip', 'site_vendor.zip', 'site_data1.zip', 'update-site.zip'] as $f) {
    if ($z->open($f) === true) {
        $z->extractTo('.');
        $z->close();
    }
}
echo 'TurfSheet Update Complete! Open https://cupdaypunting.xo.je and refresh.';
